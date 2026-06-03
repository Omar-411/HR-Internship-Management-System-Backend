import EmployeeAllowance from "../models/EmployeeAllowance.js";
import AllowanceType from "../models/AllowanceType.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { getAll, createOne, getOne } from "./handlersFactory.js";
import { markPayrollDirty } from "../utils/payrollHelpers.js";
import { errors } from "../errors/employeeAllowanceErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { validateDefaultAmount } from "../validators/allowanceTypeValidators.js";
import { parseDate } from "../utils/timeHelpers.js";
import { logAuditAction } from "../utils/logger.js";
import { validateEffectiveDates } from "../validators/employeeAllowanceValidators.js";
import { createNotification } from "../services/notificationService.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";

// Assign an allowance to an employee
export const assignAllowanceToEmployee = async (payload, ip, currentUser) => {
  const { userId, allowanceTypeId, amount, effectiveFrom, effectiveTo } =
    payload;

  // Validate required fields
  if (!userId || !allowanceTypeId || !effectiveFrom) {
    throw new AppError(
      errors.MISSING_REQUIRED_FIELDS.message,
      errors.MISSING_REQUIRED_FIELDS.code,
      errors.MISSING_REQUIRED_FIELDS.errorCode,
      errors.MISSING_REQUIRED_FIELDS.suggestion,
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

  // Check if the user is an intern and prevent assigning allowances to interns
  if (user.employment.contractType === "INTERNSHIP") {
    throw new AppError(
      errors.UNAUTHORIZED_TO_ASSIGN_ALLOWANCE_TO_INTERNS.message,
      errors.UNAUTHORIZED_TO_ASSIGN_ALLOWANCE_TO_INTERNS.code,
      errors.UNAUTHORIZED_TO_ASSIGN_ALLOWANCE_TO_INTERNS.errorCode,
      errors.UNAUTHORIZED_TO_ASSIGN_ALLOWANCE_TO_INTERNS.suggestion,
    );
  }

  // Check the allowance type existence and active status
  const allowanceType = await AllowanceType.findById(allowanceTypeId);
  if (!allowanceType || !allowanceType.active) {
    throw new AppError(
      errors.INVALID_INACTIVE_ALLOWANCE_TYPE.message,
      errors.INVALID_INACTIVE_ALLOWANCE_TYPE.code,
      errors.INVALID_INACTIVE_ALLOWANCE_TYPE.errorCode,
      errors.INVALID_INACTIVE_ALLOWANCE_TYPE.suggestion,
    );
  }

  // Validate the effective dates
  const { effectiveFromDate, effectiveToDate } = validateEffectiveDates(
    effectiveFrom,
    effectiveTo,
  );

  // Check if the employee already has an active allowance of the same type in the same period
  const existingAllowance = await EmployeeAllowance.findOne({
    userId,
    allowanceTypeId,
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

  if (existingAllowance) {
    throw new AppError(
      errors.ALLOWANCE_ALREADY_EXISTS.message,
      errors.ALLOWANCE_ALREADY_EXISTS.code,
      errors.ALLOWANCE_ALREADY_EXISTS.errorCode,
      errors.ALLOWANCE_ALREADY_EXISTS.suggestion,
    );
  }

  // Validate the new amount if provided
  if (amount !== undefined) {
    validateDefaultAmount(amount);
  }

  const finalAmount =
    amount !== undefined ? amount : allowanceType.defaultAmount;

  const result = await createOne(EmployeeAllowance)({
    userId,
    allowanceTypeId,
    amount: finalAmount,
    effectiveFrom: effectiveFromDate,
    effectiveTo: effectiveTo ? effectiveToDate : null,
  });

  await markPayrollDirty(userId, effectiveFromDate, "Allowance Assigned");

  // Create the audit log for this action
  await logAuditAction({
    adminId: currentUser.id,
    action: "ASSIGN_ALLOWANCE",
    targetType: "EmployeeAllowance",
    targetId: result.data.allowanceTypeId,
    targetName: `${user.name} ${user.lastName}`,
    details: result,
    ipAddress: ip,
  });

  // Send notification to the employee about the assigned allowance
  try {
    await createNotification({
      recipientId: user._id,
      type: "EMPLOYEE_ALLOWANCE",
      title: "Allowance Assigned",
      message: `An allowance has been assigned to you. Check the payroll section for details.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Failed to send notification for assigned allowance:", err);
  }

  // Notify all admins except the one who assigned the allowance
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: currentUser.id,
      type: "EMPLOYEE_ALLOWANCE",
      title: "Allowance Assigned",
      message: `An allowance has been assigned to ${user.name} ${user.lastName}.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send admin notification for assigned allowance:",
      err,
    );
  }

  return result;
};

// Toggle an employee's allowance active/inactive
export const toggleEmployeeAllowanceActivation = async (id, ip, user) => {
  // Check the employee allowance existence
  const allowance = await EmployeeAllowance.findById(id)
    .populate("userId", "name lastName")
    .populate("allowanceTypeId", "name");

  if (!allowance) {
    throw new AppError(
      errors.ALLOWANCE_NOT_FOUND.message,
      errors.ALLOWANCE_NOT_FOUND.code,
      errors.ALLOWANCE_NOT_FOUND.errorCode,
      errors.ALLOWANCE_NOT_FOUND.suggestion,
    );
  }

  allowance.isActive = !allowance.isActive;
  await allowance.save();

  // Get the employee details for the audit log
  const employee = allowance.userId;

  await markPayrollDirty(
    employee._id,
    new Date(),
    allowance.isActive ? "Allowance Activated" : "Allowance Deactivated",
  );

  // Create the audit log for this action
  await logAuditAction({
    adminId: user.id,
    action: "TOGGLE_ALLOWANCE_ACTIVATION",
    targetType: "EmployeeAllowance",
    targetId: allowance.id,
    targetName: `${employee.name} ${employee.lastName}`,
    details: allowance,
    ipAddress: ip,
  });

  // Send notification to the employee about the toggled allowance
  try {
    await createNotification({
      recipientId: employee._id,
      type: "EMPLOYEE_ALLOWANCE",
      title: `Allowance ${allowance.isActive ? "Activated" : "Deactivated"}`,
      message: `The "${allowance.allowanceTypeId.name}" allowance has been ${allowance.isActive ? "activated" : "deactivated"}. Check the payroll section for details.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Failed to send notification for toggled allowance:", err);
  }

  // Notify all admins except the one who assigned the allowance
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "EMPLOYEE_ALLOWANCE",
      title: `Allowance ${allowance.isActive ? "Activated" : "Deactivated"}`,
      message: `The "${allowance.allowanceTypeId.name}" allowance has been ${allowance.isActive ? "activated" : "deactivated"} for ${employee.name} ${employee.lastName}.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send admin notification for toggled allowance:",
      err,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: `Allowance ${
      allowance.isActive ? "activated" : "deactivated"
    } successfully`,
    data: allowance,
  };
};

// Get All Allowances of Employees (Can filter by userId)
export const getAllEmployeeAllowances = async (queryParams) => {
  return await getAll(
    EmployeeAllowance,
    [
      { path: "userId", select: "name lastName profileImageURL position" },
      { path: "allowanceTypeId", select: "name code isTaxable" },
    ],
    null,
    [],
  )(queryParams);
};

// Update an employee's allowance
export const updateEmployeeAllowance = async (id, payload, ip, user) => {
  // Check the employee allowance existence
  const allowance = await EmployeeAllowance.findById(id).populate(
    "allowanceTypeId",
    "name",
  );
  if (!allowance) {
    throw new AppError(
      errors.ALLOWANCE_NOT_FOUND.message,
      errors.ALLOWANCE_NOT_FOUND.code,
      errors.ALLOWANCE_NOT_FOUND.errorCode,
      errors.ALLOWANCE_NOT_FOUND.suggestion,
    );
  }

  // Get the employee details for the audit log
  const employee = await User.findById(allowance.userId);

  if (payload.amount !== undefined) {
    validateDefaultAmount(payload.amount);
    allowance.amount = payload.amount;
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

    allowance.effectiveFrom = effectiveFromDate;
    allowance.effectiveTo = effectiveToDate;
  }

  await allowance.save();
  await markPayrollDirty(
    allowance.userId,
    allowance.effectiveFrom,
    "Allowance Updated",
  );

  // Create the audit log for this action
  await logAuditAction({
    adminId: user.id,
    action: "UPDATE_ALLOWANCE",
    targetType: "EmployeeAllowance",
    targetId: allowance.id,
    targetName: `${employee.name} ${employee.lastName}`,
    details: allowance,
    ipAddress: ip,
  });

  // Send notification to the employee about the updated allowance
  try {
    await createNotification({
      recipientId: employee._id,
      type: "EMPLOYEE_ALLOWANCE",
      title: "Allowance Updated",
      message: `The "${allowance.allowanceTypeId.name}" allowance has been updated. Check the payroll section for details.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Failed to send notification for updated allowance:", err);
  }

  // Notify all admins except the one who assigned the allowance
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "EMPLOYEE_ALLOWANCE",
      title: "Allowance Updated",
      message: `The "${allowance.allowanceTypeId.name}" allowance has been updated for ${employee.name} ${employee.lastName}.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send admin notification for updated allowance:",
      err,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Employee allowance updated successfully",
    data: allowance,
  };
};

// Get an employee allowance by ID
export const getEmployeeAllowanceById = async (id, user) => {
  const isAdmin = user.role === "Admin";
  const isOwner = await EmployeeAllowance.exists({
    _id: id,
    userId: user.id,
  });

  if (!isAdmin && !isOwner) {
    throw new AppError(
      errors.UNAUTHORIZED_EMPLOYEE_ALLOWANCE_ACTION.message,
      errors.UNAUTHORIZED_EMPLOYEE_ALLOWANCE_ACTION.code,
      errors.UNAUTHORIZED_EMPLOYEE_ALLOWANCE_ACTION.errorCode,
      errors.UNAUTHORIZED_EMPLOYEE_ALLOWANCE_ACTION.suggestion,
    );
  }

  return await getOne(EmployeeAllowance, errors.ALLOWANCE_NOT_FOUND, [
    { path: "userId", select: "name lastName" },
  ])(id);
};

// Get an employee Allowances
export const getEmployeeAllowances = async (userId, user, queryParams) => {
  const isAdmin = user.role === "Admin";
  const isOwner = user.id.toString() === userId.toString();

  if (!isAdmin && !isOwner) {
    throw new AppError(
      errors.UNAUTHORIZED_EMPLOYEE_ALLOWANCE_ACTION.message,
      errors.UNAUTHORIZED_EMPLOYEE_ALLOWANCE_ACTION.code,
      errors.UNAUTHORIZED_EMPLOYEE_ALLOWANCE_ACTION.errorCode,
      errors.UNAUTHORIZED_EMPLOYEE_ALLOWANCE_ACTION.suggestion,
    );
  }

  const finalQuery = {
    ...queryParams,
    userId,
    sort: "-createdAt",
  };

  return await getAll(EmployeeAllowance, [
    { path: "userId", select: "name lastName" },
  ])(finalQuery);
};
