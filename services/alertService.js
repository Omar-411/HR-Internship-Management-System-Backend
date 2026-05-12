import Alert from "../models/Alert.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { createOne, getAll } from "./handlersFactory.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors } from "../errors/alertErrors.js";
import {
  validateAlertType,
  validateDescLength,
  validateRecipientType,
} from "../validators/alertValidators.js";
import {
  uploadDocToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";
import { resolveId } from "../utils/idResolver.js";

// Create a new alert
export const createAlert = async (payload, currentUser, file) => {
  // Check the user existence
  const sender = await User.findById(currentUser.id);
  if (!sender) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Initialize attachment fields in case an attachement is provided
  let attachmentURL = "";
  let attachmentPublicId = "";

  // Check the missing required fields
  if (
    !payload.recipientType ||
    !payload.alertType ||
    !payload.subject ||
    !payload.description
  ) {
    throw new AppError(
      errors.MISSING_FIELDS.message,
      errors.MISSING_FIELDS.code,
      errors.MISSING_FIELDS.errorCode,
      errors.MISSING_FIELDS.suggestion,
    );
  }

  // Validate the alertType value
  validateAlertType(
    payload.alertType,
    Alert.schema.path("alertType").enumValues,
  );

  // Validate the recipientType value
  validateRecipientType(
    payload.recipientType,
    Alert.schema.path("recipientType").enumValues,
  );

  // Validate the subject and description length
  validateDescLength(payload.subject, 10);
  validateDescLength(payload.description, 15);

  // Determine recipient automatically (Supervisor or Admin)
  let recipientId = null;

  if (payload.recipientType.toUpperCase() === "SUPERVISOR") {
    // The sender must have a supervisor assigned
    if (!sender.supervisor_id) {
      throw new AppError(
        errors.SUPERVISOR_NOT_ASSIGNED.message,
        errors.SUPERVISOR_NOT_ASSIGNED.code,
        errors.SUPERVISOR_NOT_ASSIGNED.errorCode,
        errors.SUPERVISOR_NOT_ASSIGNED.suggestion,
      );
    }

    recipientId = sender.supervisor_id;
  }

  // Attachement URL handling (optional)
  if (file) {
    const result = await uploadDocToCloudinary(
      file.buffer,
      file.originalname,
      "hrcom/alert_docs",
    );
    attachmentURL = result.secure_url;
    attachmentPublicId = result.public_id;
  }

  // Prepare the alert data for creation
  const alertData = {
    senderId: sender._id,
    recipientType: payload.recipientType,
    recipientId,
    alertType: payload.alertType,
    subject: payload.subject,
    description: payload.description,
    isAnonymous: payload.isAnonymous ?? false,
    attachmentURL: attachmentURL || "",
    attachmentPublicId: attachmentPublicId || "",
    status: "NEW",
  };

  const result = await createOne(Alert)(alertData);
  return result;
};

// Get all alerts for the current user
export const getMyAlerts = async (queryParams, userId) => {
  const filters = {
    ...queryParams,
    senderId: userId,
  };

  return await getAll(Alert, [
    { path: "senderId", select: "name lastName email" },
    { path: "recipientId", select: "name lastName email" },
    { path: "handledBy", select: "name lastName email" },
  ]);
};

// Get an alert by Id
export const getAlertById = async (alertId, user) => {
  // Check the alert existence
  const alert = await Alert.findById(alertId).populate([
    { path: "senderId", select: "name lastName email" },
    { path: "recipientId", select: "name lastName email" },
    { path: "handledBy", select: "name lastName email" },
  ]);

  if (!alert) {
    throw new AppError(
      errors.ALERT_NOT_FOUND.message,
      errors.ALERT_NOT_FOUND.code,
      errors.ALERT_NOT_FOUND.errorCode,
      errors.ALERT_NOT_FOUND.suggestion,
    );
  }

  // ACCESS CONTROL
  const isOwner = alert.senderId._id.toString() === user.id.toString();
  const isRecipient =
    alert.recipientId &&
    alert.recipientId._id.toString() === user.id.toString();

  if (!isOwner && !isRecipient) {
    throw new AppError(
      errors.FORBIDDEN_ACTION.message,
      errors.FORBIDDEN_ACTION.code,
      errors.FORBIDDEN_ACTION.errorCode,
      errors.FORBIDDEN_ACTION.suggestion,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Alert retrieved successfully",
    data: alert,
  };
};

// Update an alert
export const updateAlert = async (alertId, payload, user, file) => {
  // Check the alert existence
  const alert = await Alert.findById(alertId);
  if (!alert) {
    throw new AppError(
      errors.ALERT_NOT_FOUND.message,
      errors.ALERT_NOT_FOUND.code,
      errors.ALERT_NOT_FOUND.errorCode,
      errors.ALERT_NOT_FOUND.suggestion,
    );
  }

  // Only the alert sender can update
  if (alert.senderId.toString() !== user.id.toString()) {
    throw new AppError(
      errors.FORBIDDEN_ACTION.message,
      errors.FORBIDDEN_ACTION.code,
      errors.FORBIDDEN_ACTION.errorCode,
      errors.FORBIDDEN_ACTION.suggestion,
    );
  }

  // Only NEW alerts can be updated
  if (alert.status !== "NEW") {
    throw new AppError(
      errors.INVALID_STATUS.message,
      errors.INVALID_STATUS.code,
      errors.INVALID_STATUS.errorCode,
      errors.INVALID_STATUS.suggestion,
    );
  }

  // Validate the alertType value if it's being updated
  if (payload.alertType) {
    validateAlertType(
      payload.alertType,
      Alert.schema.path("alertType").enumValues,
    );
  }

  // Validate the recipientType value if it's being updated
  if (payload.recipientType) {
    validateRecipientType(
      payload.recipientType,
      Alert.schema.path("recipientType").enumValues,
    );
  }

  // Validate the subject and description length if they are being updated
  if (payload.subject) validateDescLength(payload.subject, 200);
  if (payload.description) validateDescLength(payload.description, 600);

  // If recipientType is being updated, we need to determine the new recipientId
  if (payload.recipientType) {
    if (payload.recipientType.toUpperCase() === "SUPERVISOR") {
      // The sender must have a supervisor assigned
      const sender = await User.findById(user.id);
      if (!sender.supervisor_id) {
        throw new AppError(
          errors.SUPERVISOR_NOT_ASSIGNED.message,
          errors.SUPERVISOR_NOT_ASSIGNED.code,
          errors.SUPERVISOR_NOT_ASSIGNED.errorCode,
          errors.SUPERVISOR_NOT_ASSIGNED.suggestion,
        );
      }
      alert.recipientId = sender.supervisor_id;
    } else {
      alert.recipientId = null;
    }
  }

  // Update attachment if new file is provided
  if (file) {
    // Delete the old file if it exists
    if (alert.attachmentPublicId) {
      await deleteFromCloudinary(alert.attachmentPublicId);
    }

    // Upload the new file to cloudinary
    const uploaded = await uploadDocToCloudinary(
      file.buffer,
      file.originalname,
      "hrcom/alert_docs",
    );

    alert.attachmentURL = uploaded.secure_url;
    alert.attachmentPublicId = uploaded.public_id;
  } else if (payload.removeAttachment === true) {
    if (alert.attachmentPublicId) {
      await deleteFromCloudinary(alert.attachmentPublicId, "raw");
    }

    alert.attachmentURL = "";
    alert.attachmentPublicId = "";
  }

  // Update allowed fields only
  if (payload.subject) alert.subject = payload.subject;
  if (payload.description) alert.description = payload.description;
  if (payload.isAnonymous !== undefined)
    alert.isAnonymous = payload.isAnonymous;

  // Save the changes
  const updated = await alert.save();

  return {
    status: "Success",
    code: 200,
    message: "Alert updated successfully",
    data: updated,
  };
};

// Delete an alert
export const deleteAlert = async (alertId, user) => {
  // Check the alert existence
  const alert = await Alert.findById(alertId);
  if (!alert) {
    throw new AppError(
      errors.ALERT_NOT_FOUND.message,
      errors.ALERT_NOT_FOUND.code,
      errors.ALERT_NOT_FOUND.errorCode,
      errors.ALERT_NOT_FOUND.suggestion
    );
  }

  // Only the sender can delete
  if (alert.senderId.toString() !== user.id.toString()) {
    throw new AppError(
      errors.FORBIDDEN_ACTION.message,
      errors.FORBIDDEN_ACTION.code,
      errors.FORBIDDEN_ACTION.errorCode,
      errors.FORBIDDEN_ACTION.suggestion
    );
  }

  // Only the NEW alerts can be deleted
  if (alert.status !== "NEW") {
    throw new AppError(
      errors.INVALID_STATUS.message,
      errors.INVALID_STATUS.code,
      errors.INVALID_STATUS.errorCode,
      errors.INVALID_STATUS.suggestion
    );
  }

  // Delete the attachment if it exists
  if (alert.attachmentPublicId) {
    await deleteFromCloudinary(alert.attachmentPublicId);
  }

  await Alert.findByIdAndDelete(alertId);

  return {
    status: "Success",
    code: 200,
    message: "Alert deleted successfully",
  };
};
