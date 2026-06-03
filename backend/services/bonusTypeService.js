import BonusType from "../models/BonusType.js";
import { getOne, getAll, createOne, updateOne } from "./handlersFactory.js";
import AppError from "../utils/AppError.js";
import { errors } from "../errors/bonusTypeErrors.js";
import { validateDefaultAmount } from "../validators/allowanceTypeValidators.js";
import { logAuditAction } from "../utils/logger.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";

// Add a new bonus type
export const createBonusType = async (
  { code, name, isTaxable, defaultAmount },
  user,
  ip,
) => {
  // Check for required fields
  if (!(code.trim() && name.trim())) {
    throw new AppError(
      errors.BONUS_TYPE_MISSING_FIELDS.message,
      errors.BONUS_TYPE_MISSING_FIELDS.code,
      errors.BONUS_TYPE_MISSING_FIELDS.errorCode,
      errors.BONUS_TYPE_MISSING_FIELDS.suggestion,
    );
  }

  // Check for existing bonus type with the same code
  const existing = await BonusType.findOne({
    code: code.trim().toUpperCase(),
  });
  if (existing) {
    throw new AppError(
      errors.BONUS_TYPE_CODE_EXISTS.message,
      errors.BONUS_TYPE_CODE_EXISTS.code,
      errors.BONUS_TYPE_CODE_EXISTS.errorCode,
      errors.BONUS_TYPE_CODE_EXISTS.suggestion,
    );
  }

  // Validate the default amount
  validateDefaultAmount(
    defaultAmount,
    errors.BONUS_TYPE_INVALID_DEFAULT_AMOUNT,
  );

  const result = await createOne(BonusType)({
    name: name.trim(),
    code: code.trim().toUpperCase(),
    isTaxable,
    defaultAmount,
  });

  // Create the audit log for this action
  await logAuditAction({
    adminId: user.id,
    action: "CREATE_BONUS_TYPE",
    targetType: "BonusType",
    targetId: result.data._id,
    targetName: `${result.data.name}`,
    details: result,
    ipAddress: ip,
  });

  // Notify all admins except the one who created the bonus type
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "BONUS_TYPE",
      title: "New Bonus Type Created",
      message: `A new bonus type "${name.trim()}" has been created.`,
      data: {
        entityType: "BonusType",
        entityId: result.data._id,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for new bonus type creation:",
      err,
    );
  }

  return result;
};

// Toggle the active status of a bonus type
export const toggleBonusTypeActivation = async (id, user, ip) => {
  // Check the bonus type existence
  const bonusType = await BonusType.findById(id);
  if (!bonusType) {
    throw new AppError(
      errors.BONUS_TYPE_NOT_FOUND.message,
      errors.BONUS_TYPE_NOT_FOUND.code,
      errors.BONUS_TYPE_NOT_FOUND.errorCode,
      errors.BONUS_TYPE_NOT_FOUND.suggestion,
    );
  }

  bonusType.active = !bonusType.active;
  await bonusType.save();

  // Create the audit log for this action
  await logAuditAction({
    adminId: user.id,
    action: "TOGGLE_BONUS_TYPE_ACTIVATION",
    targetType: "BonusType",
    targetId: bonusType._id,
    targetName: `${bonusType.name}`,
    details: bonusType,
    ipAddress: ip,
  });

  // Notify all admins except the one who created the bonus type
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "BONUS_TYPE",
      title: "Bonus Type Activation Status Toggled",
      message: `The activation status of the bonus type "${bonusType.name}" has been toggled.`,
      data: {
        entityType: "BonusType",
        entityId: bonusType._id,
      },
    });
  } catch (err) {
    console.error("Failed to send notification for bonus type activation toggle:", err);
  }

  return {
    status: "Success",
    code: 200,
    message: `Bonus type ${
      bonusType.active ? "activated" : "deactivated"
    } successfully`,
    data: bonusType,
  };
};

// Get all bonus types with optional filtering for active ones
export const getAllBonusTypes = async (queryParams) => {
  const modifiedQuery = { ...queryParams, limit: 6 };

  if (queryParams.activeOnly === "true") {
    modifiedQuery.active = true;
  } else if (queryParams.activeOnly === "false") {
    modifiedQuery.active = false;
  }

  delete modifiedQuery.activeOnly;

  return await getAll(BonusType, null, null, ["name", "code"])(modifiedQuery);
};

// Get a bonus type by Id
export const getBonusTypeById = getOne(BonusType, errors.BONUS_TYPE_NOT_FOUND);

// Update a bonus type
export const updateBonusType = async (
  id,
  { code, name, isTaxable, defaultAmount },
  user,
  ip,
) => {
  // Check the bonus type existence
  const bonusType = await BonusType.findById(id);
  if (!bonusType) {
    throw new AppError(
      errors.BONUS_TYPE_NOT_FOUND.message,
      errors.BONUS_TYPE_NOT_FOUND.code,
      errors.BONUS_TYPE_NOT_FOUND.errorCode,
      errors.BONUS_TYPE_NOT_FOUND.suggestion,
    );
  }

  // Validate the new code if it's being updated
  if (code && code.trim().toUpperCase() !== bonusType.code) {
    // Check for existing bonus type with the same code
    const existing = await BonusType.findOne({
      code: code.trim().toUpperCase(),
      _id: { $ne: id },
    });
    if (existing) {
      throw new AppError(
        errors.BONUS_TYPE_CODE_EXISTS.message,
        errors.BONUS_TYPE_CODE_EXISTS.code,
        errors.BONUS_TYPE_CODE_EXISTS.errorCode,
        errors.BONUS_TYPE_CODE_EXISTS.suggestion,
      );
    }
  }

  if (name !== undefined && !name.trim()) {
    throw new AppError(
      errors.BONUS_TYPE_NAME_REQUIRED.message,
      errors.BONUS_TYPE_NAME_REQUIRED.code,
      errors.BONUS_TYPE_NAME_REQUIRED.errorCode,
      errors.BONUS_TYPE_NAME_REQUIRED.suggestion,
    );
  }

  // Validate the default amount if it's being updated
  if (defaultAmount !== undefined) {
    validateDefaultAmount(
      defaultAmount,
      errors.BONUS_TYPE_INVALID_DEFAULT_AMOUNT,
    );
  }

  const result = await updateOne(BonusType)(id, {
    code: code ? code.trim().toUpperCase() : bonusType.code,
    name: name ? name.trim() : bonusType.name,
    isTaxable: isTaxable !== undefined ? isTaxable : bonusType.isTaxable,
    defaultAmount:
      defaultAmount !== undefined ? defaultAmount : bonusType.defaultAmount,
  });

  // Create the audit log for this action
  await logAuditAction({
    adminId: user.id,
    action: "UPDATE_BONUS_TYPE",
    targetType: "BonusType",
    targetId: bonusType._id,
    targetName: `${bonusType.name}`,
    details: bonusType,
    ipAddress: ip,
  });

  // Notify all admins except the one who created the bonus type
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "BONUS_TYPE",
      title: "Bonus Type Updated",
      message: `The bonus type "${bonusType.name}" has been updated.`,
      data: {
        entityType: "BonusType",
        entityId: result.data._id,
      },
    });
  } catch (err) {
    console.error("Failed to send notification for bonus type update:", err);
  }

  return result;
};
