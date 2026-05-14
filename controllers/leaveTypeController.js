import LeaveType from "../models/LeaveType.js";
import { errors } from "../errors/leaveTypeErrors.js";
import AppError from "../utils/AppError.js";
import { logAuditAction } from "../utils/logger.js"; // For audit logs
import { getAll } from "../services/handlersFactory.js";
import {
  syncLeaveTypeToUsers,
  addLeaveTypeToUsers,
  removeLeaveTypeFromUsers,
} from "../services/leaveWalletService.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";

// ---------------------------------------------------------------- //
// ----------------------- HELPER FUNCTIONS ----------------------- //
// ---------------------------------------------------------------- //
export const validateLeaveTypeName = (name) => {
  if (!name || name.trim() === "") {
    throw new AppError(
      errors.LEAVE_TYPE_NAME_REQUIRED.message,
      errors.LEAVE_TYPE_NAME_REQUIRED.code,
      errors.LEAVE_TYPE_NAME_REQUIRED.errorCode,
      errors.LEAVE_TYPE_NAME_REQUIRED.suggestion,
    );
  }

  // Normalize the leave type name
  return (
    name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase()
  );
};

export const validateDefaultDays = (defaultDays) => {
  if (defaultDays === undefined || defaultDays < 0) {
    throw new AppError(
      errors.INVALID_DEFAULT_DAYS.message,
      errors.INVALID_DEFAULT_DAYS.code,
      errors.INVALID_DEFAULT_DAYS.errorCode,
      errors.INVALID_DEFAULT_DAYS.suggestion,
    );
  }
};

export const validateMaxDays = (maxDays) => {
  if (maxDays === undefined || maxDays < 0) {
    throw new AppError(
      errors.INVALID_MAX_DAYS.message,
      errors.INVALID_MAX_DAYS.code,
      errors.INVALID_MAX_DAYS.errorCode,
      errors.INVALID_MAX_DAYS.suggestion,
    );
  }
};

export const validateLeaveTypeGender = (gender) => {
  const allowedGenders = LeaveType.schema.path("gender").enumValues;
  if (!allowedGenders.includes(gender)) {
    throw new AppError(
      errors.INVALID_GENDER.message,
      errors.INVALID_GENDER.code,
      errors.INVALID_GENDER.errorCode,
      errors.INVALID_GENDER.suggestion,
    );
  }
};

export const validateLeaveTypeDeductFrom = (deductFrom) => {
  const allowedValues = LeaveType.schema.path("deductFrom").enumValues;
  if (!allowedValues.includes(deductFrom)) {
    throw new AppError(
      errors.INVALID_DEDUCT_FROM.message,
      errors.INVALID_DEDUCT_FROM.code,
      errors.INVALID_DEDUCT_FROM.errorCode,
      errors.INVALID_DEDUCT_FROM.suggestion,
    );
  }
};

// Check the name existance
export const checkLeaveTypeNameExistence = async (name, id) => {
  const existingLeaveType = await LeaveType.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
    _id: { $ne: id },
  });

  if (existingLeaveType) {
    throw new AppError(
      errors.LEAVE_TYPE_ALREADY_EXISTS.message,
      errors.LEAVE_TYPE_ALREADY_EXISTS.code,
      errors.LEAVE_TYPE_ALREADY_EXISTS.errorCode,
      errors.LEAVE_TYPE_ALREADY_EXISTS.suggestion,
    );
  }
};

// ---------------------------------------------------------------- //
// ---------------------- LEAVE TYPE MANAGEMENT ------------------- //
// ---------------------------------------------------------------- //

// Get all leave types
export const getAllLeaveTypes = async (req, res, next) => {
  try {
    let queryParams = req.query;
    queryParams = {
      ...queryParams,
      limit: queryParams.limit || 100,
      sort: "-createdAt",
    };

    const result = await getAll(LeaveType, null, null, ["name"])(queryParams);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Add a new Leave Type (Admin only)
export const addLeaveType = async (req, res, next) => {
  try {
    let { name } = req.body;
    const {
      description,
      isPaid,
      deductFrom,
      defaultDays,
      maxDays,
      gender,
      requiresChildBirth,
    } = req.body;

    // Validate the leave type name
    name = validateLeaveTypeName(name);

    // Check the name existance
    await checkLeaveTypeNameExistence(name, null);

    // Validate the default days value
    validateDefaultDays(defaultDays);

    // Validate the max days value
    validateMaxDays(maxDays);

    // Validate the gender
    validateLeaveTypeGender(gender);

    // Validate the deductFrom value
    validateLeaveTypeDeductFrom(deductFrom);

    // If the leave type is related to childbirth, ensure that the gender is not set to "Both"
    if (requiresChildBirth && gender === "Both") {
      throw new AppError(
        errors.GENDER_REQUIRED_FOR_CHILD_BIRTH.message,
        errors.GENDER_REQUIRED_FOR_CHILD_BIRTH.code,
        errors.GENDER_REQUIRED_FOR_CHILD_BIRTH.errorCode,
        errors.GENDER_REQUIRED_FOR_CHILD_BIRTH.suggestion,
      );
    }

    // Add the new leave type (By default, the status will be "Active")
    const newLeaveType = await LeaveType.create({
      name,
      description,
      isPaid,
      defaultDays,
      gender,
      requiresChildBirth,
      deductFrom,
      maxDays,
    });

    // Add the new leave type to all users' leave balances
    await addLeaveTypeToUsers(newLeaveType);

    // Notify all admins except the one who created the leave type
    try {
      await createNotificationForAdminsExcept({
        excludedUserId: req.user.id,
        type: "LEAVE_TYPE",
        title: "New Leave Type Created",
        message: `A new leave type "${name.trim()}" has been created.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error(
        "Failed to send notification for new leave type creation:",
        err,
      );
    }

    // Logging the action
    try {
      await logAuditAction({
        adminId: req.user.id,
        action: "CREATE_LEAVE_TYPE",
        targetType: "LeaveType",
        targetId: newLeaveType._id,
        targetName: newLeaveType.name,
        ipAddress: req.ip,
      });
    } catch (logErr) {
      console.log("[AUDIT-LOG-ERROR]", logErr.message);
    }

    res.status(201).json({
      status: "Success",
      code: 201,
      message: "Leave type created successfully!",
      data: newLeaveType,
    });
  } catch (err) {
    next(err);
  }
};

// Update an existing Leave Type (Admin only)
export const updateLeaveType = async (req, res, next) => {
  try {
    const { id } = req.params;
    let {
      name,
      description,
      isPaid,
      defaultDays,
      maxDays,
      deductFrom,
      gender,
      requiresChildBirth,
    } = req.body;

    // Check the leave type existance
    const existingLeaveType = await LeaveType.findById(id);
    if (!existingLeaveType) {
      throw new AppError(
        errors.LEAVE_TYPE_NOT_FOUND.message,
        errors.LEAVE_TYPE_NOT_FOUND.code,
        errors.LEAVE_TYPE_NOT_FOUND.errorCode,
        errors.LEAVE_TYPE_NOT_FOUND.suggestion,
      );
    }

    // Store the old defaultDays value before the update
    const oldDefaultDays = existingLeaveType.defaultDays;

    // Prevent updating an archived leave type
    if (existingLeaveType.status === "Archived") {
      throw new AppError(
        errors.LEAVE_TYPE_ARCHIVED.message,
        errors.LEAVE_TYPE_ARCHIVED.code,
        errors.LEAVE_TYPE_ARCHIVED.errorCode,
        errors.LEAVE_TYPE_ARCHIVED.suggestion,
      );
    }

    const updateData = {};

    // Update name (if provided)
    if (name) {
      name = await validateLeaveTypeName(name);
      await checkLeaveTypeNameExistence(name, id);
      updateData.name = name.trim();
    }

    // Update description (if provided)
    if (description !== undefined) {
      updateData.description = description;
    }

    // Update isPaid (if provided)
    if (isPaid !== undefined) {
      updateData.isPaid = isPaid;
    }

    // Update the defaultDays (if provided)
    if (defaultDays !== undefined) {
      validateDefaultDays(defaultDays);
      updateData.defaultDays = defaultDays;
    }

    // Update the maxDays (if provided)
    if (maxDays !== undefined) {
      validateMaxDays(maxDays);
      updateData.maxDays = maxDays;
    }

    // Update the deductFrom value (if provided)
    if (deductFrom !== undefined) {
      validateLeaveTypeDeductFrom(deductFrom);
      updateData.deductFrom = deductFrom;
    }

    // Update the gender (if provided)
    if (gender !== undefined) {
      validateLeaveTypeGender(gender);
      updateData.gender = gender;
    }

    // Update requiresChildBirth
    const finalGender = gender ?? existingLeaveType.gender;
    if (requiresChildBirth !== undefined) {
      if (requiresChildBirth && finalGender === "Both") {
        throw new AppError(
          errors.GENDER_REQUIRED_FOR_CHILD_BIRTH.message,
          errors.GENDER_REQUIRED_FOR_CHILD_BIRTH.code,
          errors.GENDER_REQUIRED_FOR_CHILD_BIRTH.errorCode,
          errors.GENDER_REQUIRED_FOR_CHILD_BIRTH.suggestion,
        );
      }
      updateData.requiresChildBirth = requiresChildBirth;
    }

    const updatedLeaveType = await LeaveType.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
      runValidators: true,
    });

    // Only sync if defaultDays was actually changed
    if (defaultDays !== undefined) {
      await syncLeaveTypeToUsers(
        id,
        oldDefaultDays,
        updatedLeaveType.defaultDays,
      );
    }

    // Logging the action
    try {
      await logAuditAction({
        adminId: req.user.id,
        action: "UPDATE_LEAVE_TYPE",
        targetType: "LeaveType",
        targetId: updatedLeaveType._id,
        targetName: updatedLeaveType.name,
        ipAddress: req.ip,
      });
    } catch (logErr) {
      console.log("[AUDIT-LOG-ERROR]", logErr.message);
    }

    // Notify all admins except the one who restored the leave type
    try {
      await createNotificationForAdminsExcept({
        excludedUserId: req.user.id,
        type: "LEAVE_TYPE",
        title: "Leave Type Updated",
        message: `The leave type "${updatedLeaveType.name}" has been updated.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error("Failed to send notification for leave type update:", err);
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Leave type updated successfully!",
      data: updatedLeaveType,
    });
  } catch (err) {
    next(err);
  }
};

// Archive a leave type (Admin only)
export const archiveLeaveType = async (req, res, next) => {
  try {
    const { id } = req.params; // Leave type ID

    // Check the leave type existance
    const existingLeaveType = await LeaveType.findById(id);
    if (!existingLeaveType) {
      throw new AppError(
        errors.LEAVE_TYPE_NOT_FOUND.message,
        errors.LEAVE_TYPE_NOT_FOUND.code,
        errors.LEAVE_TYPE_NOT_FOUND.errorCode,
        errors.LEAVE_TYPE_NOT_FOUND.suggestion,
      );
    }

    // Check if the leave type is already archived
    if (existingLeaveType.status === "Archived") {
      throw new AppError(
        errors.LEAVE_TYPE_ARCHIVED.message,
        errors.LEAVE_TYPE_ARCHIVED.code,
        errors.LEAVE_TYPE_ARCHIVED.errorCode,
        errors.LEAVE_TYPE_ARCHIVED.suggestion,
      );
    }

    // Archive the leave type
    existingLeaveType.status = "Archived";
    await existingLeaveType.save();

    // Remove the leave type from users' leave balances
    await removeLeaveTypeFromUsers(existingLeaveType._id);

    // Logging the action
    try {
      await logAuditAction({
        adminId: req.user.id,
        action: "ARCHIVE_LEAVE_TYPE",
        targetType: "LeaveType",
        targetId: existingLeaveType._id,
        targetName: existingLeaveType.name,
        ipAddress: req.ip,
      });
    } catch (logErr) {
      console.log("[AUDIT-LOG-ERROR]", logErr.message);
    }

    // Notify all admins except the one who archived the leave type
    try {
      await createNotificationForAdminsExcept({
        excludedUserId: req.user.id,
        type: "LEAVE_TYPE",
        title: "Leave Type Archived",
        message: `The leave type "${existingLeaveType.name}" has been archived.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error(
        "Failed to send notification for leave type archiving:",
        err,
      );
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Leave type archived successfully!",
      data: existingLeaveType,
    });
  } catch (err) {
    next(err);
  }
};

// Restore an archived leave type (Admin only)
export const restoreLeaveType = async (req, res, next) => {
  try {
    const { id } = req.params; // Leave type ID

    // Check the leave type existance
    const existingLeaveType = await LeaveType.findById(id);
    if (!existingLeaveType) {
      throw new AppError(
        errors.LEAVE_TYPE_NOT_FOUND.message,
        errors.LEAVE_TYPE_NOT_FOUND.code,
        errors.LEAVE_TYPE_NOT_FOUND.errorCode,
        errors.LEAVE_TYPE_NOT_FOUND.suggestion,
      );
    }

    // Check if the leave type is already active
    if (existingLeaveType.status === "Active") {
      throw new AppError(
        errors.LEAVE_TYPE_ALREADY_ACTIVE.message,
        errors.LEAVE_TYPE_ALREADY_ACTIVE.code,
        errors.LEAVE_TYPE_ALREADY_ACTIVE.errorCode,
        errors.LEAVE_TYPE_ALREADY_ACTIVE.suggestion,
      );
    }

    // Restore the leave type
    existingLeaveType.status = "Active";
    await existingLeaveType.save();

    // Add the restored leave type to all users' leave balances
    await addLeaveTypeToUsers(existingLeaveType);

    // Logging the action
    try {
      await logAuditAction({
        adminId: req.user.id,
        action: "RESTORE_LEAVE_TYPE",
        targetType: "LeaveType",
        targetId: existingLeaveType._id,
        targetName: existingLeaveType.name,
        ipAddress: req.ip,
      });
    } catch (logErr) {
      console.log("[AUDIT-LOG-ERROR]", logErr.message);
    }

    // Notify all admins except the one who restored the leave type
    try {
      await createNotificationForAdminsExcept({
        excludedUserId: req.user.id,
        type: "LEAVE_TYPE",
        title: "Leave Type Restored",
        message: `The leave type "${existingLeaveType.name}" has been restored.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error(
        "Failed to send notification for leave type restoration:",
        err,
      );
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Leave type restored successfully!",
      data: existingLeaveType,
    });
  } catch (err) {
    next(err);
  }
};
