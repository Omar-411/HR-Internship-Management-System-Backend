import AllowanceType from "../models/AllowanceType.js";
import { getOne, getAll, createOne, updateOne } from "./handlersFactory.js";
import AppError from "../utils/AppError.js";
import { errors } from "../errors/allowanceTypeErrors.js";
import { validateDefaultAmount } from "../validators/allowanceTypeValidators.js";
import { logAuditAction } from "../utils/logger.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";

// Add a new allowance type
export const createAllowanceType = async (
  { code, name, isTaxable, defaultAmount },
  ip,
  user,
) => {
  // Check for required fields
  if (!(code.trim() && name.trim())) {
    throw new AppError(
      errors.ALLOWANCE_TYPE_MISSING_FIELDS.message,
      errors.ALLOWANCE_TYPE_MISSING_FIELDS.code,
      errors.ALLOWANCE_TYPE_MISSING_FIELDS.errorCode,
      errors.ALLOWANCE_TYPE_MISSING_FIELDS.suggestion,
    );
  }

  // Check for existing allowance type with the same code
  const existing = await AllowanceType.findOne({
    code: code.trim().toUpperCase(),
  });
  if (existing) {
    throw new AppError(
      errors.ALLOWANCE_TYPE_CODE_EXISTS.message,
      errors.ALLOWANCE_TYPE_CODE_EXISTS.code,
      errors.ALLOWANCE_TYPE_CODE_EXISTS.errorCode,
      errors.ALLOWANCE_TYPE_CODE_EXISTS.suggestion,
    );
  }

  // Validate the default amount
  validateDefaultAmount(defaultAmount);

  const result = await createOne(AllowanceType)({
    name: name.trim(),
    code: code.trim().toUpperCase(),
    isTaxable,
    defaultAmount,
  });

  // Create the audit log for this action
  await logAuditAction({
    adminId: user.id,
    action: "CREATE_ALLOWANCE_TYPE",
    targetType: "AllowanceType",
    targetId: result.data._id,
    targetName: `${result.data.name}`,
    details: result,
    ipAddress: ip,
  });

  // Notify all admins except the one who created the allowance type
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "ALLOWANCE_TYPE",
      title: "New Allowance Type Created",
      message: `A new allowance type "${result.data.name}" has been created.`,
      data: {
        entityType: "AllowanceType",
        entityId: result.data._id,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for new allowance type creation:",
      err,
    );
  }

  return result;
};

// Toggle the active status of an allowance type
export const toggleAllowanceTypeActivation = async (id, user, ip) => {
  // Check the allowance type existence
  const allowanceType = await AllowanceType.findById(id);
  if (!allowanceType) {
    throw new AppError(
      errors.ALLOWANCE_TYPE_NOT_FOUND.message,
      errors.ALLOWANCE_TYPE_NOT_FOUND.code,
      errors.ALLOWANCE_TYPE_NOT_FOUND.errorCode,
      errors.ALLOWANCE_TYPE_NOT_FOUND.suggestion,
    );
  }

  allowanceType.active = !allowanceType.active;
  await allowanceType.save();

  // Create the audit log for this action
  await logAuditAction({
    adminId: user.id,
    action: "TOGGLE_ALLOWANCE_TYPE_ACTIVATION",
    targetType: "AllowanceType",
    targetId: allowanceType._id,
    targetName: `${allowanceType.name}`,
    details: allowanceType,
    ipAddress: ip,
  });

  // Notify all admins except the one who created the allowance type
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "ALLOWANCE_TYPE",
      title: "Allowance Type Activation Status Toggled",
      message: `The activation status of the allowance type "${allowanceType.name}" has been toggled.`,
      data: {
        entityType: "AllowanceType",
        entityId: allowanceType._id,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for allowance type activation toggle:",
      err,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: `Allowance type ${
      allowanceType.active ? "activated" : "deactivated"
    } successfully`,
    data: allowanceType,
  };
};

// Get all allowance types with optional filtering for active ones
export const getAllAllowanceTypes = async (queryParams) => {
  const modifiedQuery = { ...queryParams, limit: 6 };

  if (queryParams.activeOnly === "true") {
    modifiedQuery.active = true;
  } else if (queryParams.activeOnly === "false") {
    modifiedQuery.active = false;
  }

  delete modifiedQuery.activeOnly;

  return await getAll(AllowanceType, null, null, ["name", "code"])(
    modifiedQuery,
  );
};

// Get an allowance type by Id
export const getAllowanceTypeById = getOne(
  AllowanceType,
  errors.ALLOWANCE_TYPE_NOT_FOUND,
);

// Update an allowance type
export const updateAllowanceType = async (
  id,
  { code, name, isTaxable, defaultAmount },
  user,
  ip,
) => {
  // Check the allowance type existence
  const allowanceType = await AllowanceType.findById(id);
  if (!allowanceType) {
    throw new AppError(
      errors.ALLOWANCE_TYPE_NOT_FOUND.message,
      errors.ALLOWANCE_TYPE_NOT_FOUND.code,
      errors.ALLOWANCE_TYPE_NOT_FOUND.errorCode,
      errors.ALLOWANCE_TYPE_NOT_FOUND.suggestion,
    );
  }

  // Validate the new code if it's being updated
  if (code && code.trim().toUpperCase() !== allowanceType.code) {
    // Check for existing allowance type with the same code
    const existing = await AllowanceType.findOne({
      code: code.trim().toUpperCase(),
      _id: { $ne: id },
    });
    if (existing) {
      throw new AppError(
        errors.ALLOWANCE_TYPE_CODE_EXISTS.message,
        errors.ALLOWANCE_TYPE_CODE_EXISTS.code,
        errors.ALLOWANCE_TYPE_CODE_EXISTS.errorCode,
        errors.ALLOWANCE_TYPE_CODE_EXISTS.suggestion,
      );
    }
  }

  if (name !== undefined && !name.trim()) {
    throw new AppError(
      errors.ALLOWANCE_TYPE_NAME_REQUIRED.message,
      errors.ALLOWANCE_TYPE_NAME_REQUIRED.code,
      errors.ALLOWANCE_TYPE_NAME_REQUIRED.errorCode,
      errors.ALLOWANCE_TYPE_NAME_REQUIRED.suggestion,
    );
  }

  // Validate the default amount if it's being updated
  if (defaultAmount !== undefined) {
    validateDefaultAmount(defaultAmount);
  }

  const result = await updateOne(AllowanceType)(id, {
    code: code ? code.trim().toUpperCase() : allowanceType.code,
    name: name ? name.trim() : allowanceType.name,
    isTaxable: isTaxable !== undefined ? isTaxable : allowanceType.isTaxable,
    defaultAmount:
      defaultAmount !== undefined ? defaultAmount : allowanceType.defaultAmount,
  });

  // Create the audit log for this action
  await logAuditAction({
    adminId: user.id,
    action: "UPDATE_ALLOWANCE_TYPE",
    targetType: "AllowanceType",
    targetId: allowanceType._id,
    targetName: `${allowanceType.name}`,
    details: allowanceType,
    ipAddress: ip,
  });

  // Notify all admins except the one who created the allowance type
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "ALLOWANCE_TYPE",
      title: "Allowance Type updated",
      message: `The allowance type "${result.data.name}" has been updated.`,
      data: {
        entityType: "AllowanceType",
        entityId: result.data._id,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for allowance type update:",
      err,
    );
  }

  return result;
};
