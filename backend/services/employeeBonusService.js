import EmployeeBonus from "../models/EmployeeBonus.js";
import BonusType from "../models/BonusType.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { getAll, createOne, getOne } from "./handlersFactory.js";
import { markPayrollDirty } from "../utils/payrollHelpers.js";
import { errors } from "../errors/employeeBonusErrors.js";
import { errors as employeeAllowanceErrors } from "../errors/employeeAllowanceErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { validateDefaultAmount } from "../validators/allowanceTypeValidators.js";
import { parseDate } from "../utils/timeHelpers.js";
import { logAuditAction } from "../utils/logger.js";
import { validateEffectiveDates } from "../validators/employeeAllowanceValidators.js";
import { createNotification } from "../services/notificationService.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";

// Assign a bonus to an employee
export const assignBonusToEmployee = async (payload, ip, currentUser) => {
  const { userId, bonusTypeId, amount, effectiveFrom, effectiveTo } = payload;

  // Validate required fields
  if (!userId || !bonusTypeId || !effectiveFrom) {
    throw new AppError(
      employeeAllowanceErrors.MISSING_REQUIRED_FIELDS.message,
      employeeAllowanceErrors.MISSING_REQUIRED_FIELDS.code,
      employeeAllowanceErrors.MISSING_REQUIRED_FIELDS.errorCode,
      employeeAllowanceErrors.MISSING_REQUIRED_FIELDS.suggestion,
    );
  }

  // Check the employee existence
  const user = await User.findById(userId).populate("employment.contractType");
  if (!user)
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );

  // Check if the user is an intern and prevent assigning bonuses to interns
  if (user.employment.contractType === "INTERNSHIP") {
    throw new AppError(
      errors.UNAUTHORIZED_TO_ASSIGN_BONUS_TO_INTERNS.message,
      errors.UNAUTHORIZED_TO_ASSIGN_BONUS_TO_INTERNS.code,
      errors.UNAUTHORIZED_TO_ASSIGN_BONUS_TO_INTERNS.errorCode,
      errors.UNAUTHORIZED_TO_ASSIGN_BONUS_TO_INTERNS.suggestion,
    );
  }

  // Check the bonus type existence and active status
  const bonusType = await BonusType.findById(bonusTypeId);
  if (!bonusType || !bonusType.active) {
    throw new AppError(
      errors.INVALID_INACTIVE_BONUS_TYPE.message,
      errors.INVALID_INACTIVE_BONUS_TYPE.code,
      errors.INVALID_INACTIVE_BONUS_TYPE.errorCode,
      errors.INVALID_INACTIVE_BONUS_TYPE.suggestion,
    );
  }

  // Validate the effective dates
  const { effectiveFromDate, effectiveToDate } = validateEffectiveDates(
    effectiveFrom,
    effectiveTo,
  );

  // Check if the employee already has an active bonus of the same type in the same period
  const existingBonus = await EmployeeBonus.findOne({
    userId,
    bonusTypeId,
    isActive: true,
    $or: [
      {
        effectiveTo: null,
      },
      {
        effectiveFrom: { $lte: effectiveToDate },
        effectiveTo: { $gte: effectiveFromDate },
      },
    ],
  });

  if (existingBonus) {
    throw new AppError(
      errors.BONUS_ALREADY_EXISTS.message,
      errors.BONUS_ALREADY_EXISTS.code,
      errors.BONUS_ALREADY_EXISTS.errorCode,
      errors.BONUS_ALREADY_EXISTS.suggestion,
    );
  }

  // Validate the new amount if provided
  if (amount !== undefined) {
    validateDefaultAmount(amount);
  }

  const finalAmount = amount !== undefined ? amount : bonusType.defaultAmount;

  const result = await createOne(EmployeeBonus)({
    userId,
    bonusTypeId,
    amount: finalAmount,
    effectiveFrom: effectiveFromDate,
    effectiveTo: effectiveTo ? effectiveToDate : null,
  });

  await markPayrollDirty(userId, effectiveFromDate, "Bonus Assigned");

  // Create the audit log for this action
  await logAuditAction({
    adminId: currentUser.id,
    action: "ASSIGN_BONUS",
    targetType: "EmployeeBonus",
    targetId: result.data.bonusTypeId,
    targetName: `${user.name} ${user.lastName}`,
    details: result,
    ipAddress: ip,
  });

  // Send notification to the employee about the assigned bonus
  try {
    await createNotification({
      recipientId: user._id,
      type: "EMPLOYEE_BONUS",
      title: "Bonus Assigned",
      message: `A bonus has been assigned to you. Check the payroll section for details.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Failed to send notification for assigned bonus:", err);
  }

  // Notify all admins except the one who assigned the bonus
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: currentUser.id,
      type: "EMPLOYEE_BONUS",
      title: "Bonus Assigned",
      message: `A bonus has been assigned to ${user.name} ${user.lastName}.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Failed to send admin notification for assigned bonus:", err);
  }

  return result;
};

// Toggle an employee's bonus active/inactive
export const toggleEmployeeBonusActivation = async (id, ip, user) => {
  // Check the employee bonus existence
  const bonus = await EmployeeBonus.findById(id)
  .populate("userId", "name lastName")
  .populate("bonusTypeId", "name");
  
  if (!bonus) {
    throw new AppError(
      errors.BONUS_NOT_FOUND.message,
      errors.BONUS_NOT_FOUND.code,
      errors.BONUS_NOT_FOUND.errorCode,
      errors.BONUS_NOT_FOUND.suggestion,
    );
  }

  bonus.isActive = !bonus.isActive;
  await bonus.save();

  // Get the employee details for the audit log
  const employee = bonus.userId;

  await markPayrollDirty(
    employee._id,
    new Date(),
    bonus.isActive ? "Bonus Activated" : "Bonus Deactivated",
  );

  // Create the audit log for this action
  await logAuditAction({
    adminId: user.id,
    action: "TOGGLE_BONUS_ACTIVATION",
    targetType: "EmployeeBonus",
    targetId: bonus.id,
    targetName: `${employee.name} ${employee.lastName}`,
    details: bonus,
    ipAddress: ip,
  });

  // Send notification to the employee about the toggled bonus
  try {
    await createNotification({
      recipientId: employee._id,
      type: "EMPLOYEE_BONUS",
      title: `Bonus ${bonus.isActive ? "Activated" : "Deactivated"}`,
      message: `The "${bonus.bonusTypeId.name}" bonus has been ${bonus.isActive ? "activated" : "deactivated"}. Check the payroll section for details.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Failed to send notification for toggled bonus:", err);
  }

  // Notify all admins except the one who assigned the bonus
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "EMPLOYEE_BONUS",
      title: `Bonus ${bonus.isActive ? "Activated" : "Deactivated"}`,
      message: `The "${bonus.bonusTypeId.name}" bonus has been ${bonus.isActive ? "activated" : "deactivated"} for ${employee.name} ${employee.lastName}.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Failed to send admin notification for toggled bonus:", err);
  }

  return {
    status: "Success",
    code: 200,
    message: `Bonus ${
      bonus.isActive ? "activated" : "deactivated"
    } successfully`,
    data: bonus,
  };
};

// Get All Bonuses of Employees (Can filter by userId)
export const getAllEmployeeBonuses = async (queryParams) => {
  return await getAll(
    EmployeeBonus,
    [
      { path: "userId", select: "name lastName profileImageURL position" },
      { path: "bonusTypeId", select: "name code isTaxable" },
    ],
    null,
    [],
  )(queryParams);
};

// Update an employee's bonus
export const updateEmployeeBonus = async (id, payload, ip, user) => {
  // Check the employee bonus existence
  const bonus = await EmployeeBonus.findById(id).populate("bonusTypeId", "name");
  if (!bonus) {
    throw new AppError(
      errors.BONUS_NOT_FOUND.message,
      errors.BONUS_NOT_FOUND.code,
      errors.BONUS_NOT_FOUND.errorCode,
      errors.BONUS_NOT_FOUND.suggestion,
    );
  }

  // Get the employee details for the audit log
  const employee = await User.findById(bonus.userId);

  if (payload.amount !== undefined) {
    validateDefaultAmount(payload.amount);
    bonus.amount = payload.amount;
  }

  // Validate the effective dates
  if (
    payload.effectiveFrom !== undefined ||
    payload.effectiveTo !== undefined
  ) {
    const { effectiveFromDate, effectiveToDate } = validateEffectiveDates(
      payload.effectiveFrom,
      payload.effectiveTo,
    );

    bonus.effectiveFrom = effectiveFromDate;
    bonus.effectiveTo = effectiveToDate;
  }

  await bonus.save();
  await markPayrollDirty(bonus.userId, bonus.effectiveFrom, "Bonus Updated");

  // Create the audit log for this action
  await logAuditAction({
    adminId: user.id,
    action: "UPDATE_BONUS",
    targetType: "EmployeeBonus",
    targetId: bonus.id,
    targetName: `${employee.name} ${employee.lastName}`,
    details: bonus,
    ipAddress: ip,
  });

  // Send notification to the employee about the updated bonus
  try {
    await createNotification({
      recipientId: employee._id,
      type: "EMPLOYEE_BONUS",
      title: "Bonus Updated",
      message: `The "${bonus.bonusTypeId.name}" bonus has been updated. Check the payroll section for details.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Failed to send notification for updated bonus:", err);
  }

  // Notify all admins except the one who assigned the bonus
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "EMPLOYEE_BONUS",
      title: "Bonus Updated",
      message: `The "${bonus.bonusTypeId.name}" bonus has been updated for ${employee.name} ${employee.lastName}.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Failed to send admin notification for updated bonus:", err);
  }

  return {
    status: "Success",
    code: 200,
    message: "Employee bonus updated successfully",
    data: bonus,
  };
};

// Get an employee bonus by ID
export const getEmployeeBonusById = async (id, user) => {
  const isAdmin = user.role === "Admin";
  const isOwner = await EmployeeBonus.exists({
    _id: id,
    userId: user.id,
  });

  if (!isAdmin && !isOwner) {
    throw new AppError(
      errors.UNAUTHORIZED_EMPLOYEE_BONUS_ACTION.message,
      errors.UNAUTHORIZED_EMPLOYEE_BONUS_ACTION.code,
      errors.UNAUTHORIZED_EMPLOYEE_BONUS_ACTION.errorCode,
      errors.UNAUTHORIZED_EMPLOYEE_BONUS_ACTION.suggestion,
    );
  }

  return await getOne(EmployeeBonus, errors.BONUS_NOT_FOUND, [
    { path: "userId", select: "name lastName" },
  ])(id);
};

// Get an employee Bonuses
export const getEmployeeBonuses = async (userId, user, queryParams) => {
  const isAdmin = user.role === "Admin";
  const isOwner = user.id.toString() === userId.toString();

  if (!isAdmin && !isOwner) {
    throw new AppError(
      errors.UNAUTHORIZED_EMPLOYEE_BONUS_ACTION.message,
      errors.UNAUTHORIZED_EMPLOYEE_BONUS_ACTION.code,
      errors.UNAUTHORIZED_EMPLOYEE_BONUS_ACTION.errorCode,
      errors.UNAUTHORIZED_EMPLOYEE_BONUS_ACTION.suggestion,
    );
  }

  const finalQuery = {
    ...queryParams,
    userId,
    sort: "-createdAt",
  };

  return await getAll(EmployeeBonus, [
    { path: "userId", select: "name lastName" },
  ])(finalQuery);
};
