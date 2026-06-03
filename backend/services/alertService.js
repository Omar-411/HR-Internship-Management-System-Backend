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
  validateAlertActionAccess,
} from "../validators/alertValidators.js";
import {
  uploadDocToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";
import { logAuditAction } from "../utils/logger.js"; // For the admin audit logs
import { createNotification } from "./notificationService.js";
import { createNotificationForAdmins } from "../utils/notificationHelpers.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";

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
  validateDescLength(payload.subject, 200);
  validateDescLength(payload.description, 600);

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

  if (result.data.recipientType === "SUPERVISOR") {
    // Send a notification to the employee about the clarification request
    try {
      await createNotification({
        recipientId: recipientId,
        type: "ALERT",
        title: "New alert submitted",
        message: `${sender.name} ${sender.lastName} has submitted an alert.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error("Failed to send notification for the alert creation:", err);
    }
  } else if (result.data.recipientType === "HR_DEPARTMENT") {
    // Send a notification for all admins about the alert creation
    try {
      await createNotificationForAdmins({
        type: "ALERT",
        title: "New alert submitted",
        message: `${sender.name} ${sender.lastName} has submitted an alert.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error("Failed to send notification for the alert creation:", err);
    }
  }

  return result;
};

// Get all alerts for the current user
export const getMyAlerts = async (queryParams, userId) => {
  const filters = {
    ...queryParams,
    senderId: userId,
  };

  return await getAll(
    Alert,
    [
      { path: "senderId", select: "name lastName email" },
      { path: "recipientId", select: "name lastName email" },
      { path: "handledBy", select: "name lastName email" },
    ],
    null,
    ["subject", "description"],
  )(filters);
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
      "You are not allowed to update this alert.",
      errors.FORBIDDEN_ACTION.code,
      errors.FORBIDDEN_ACTION.errorCode,
      "Only the sender can update this alert.",
    );
  }

  // Only NEW alerts can be updated
  if (alert.status !== "NEW") {
    throw new AppError(
      "Only new alerts can be updated.",
      errors.INVALID_STATUS.code,
      errors.INVALID_STATUS.errorCode,
      "You cannot update an alert after it enters review.",
    );
  }

  // Validate the alertType value if it's being updated
  if (payload.alertType !== undefined) {
    validateAlertType(
      payload.alertType,
      Alert.schema.path("alertType").enumValues,
    );

    alert.alertType = payload.alertType.toUpperCase();
  }

  // Validate the recipientType value if it's being updated
  if (payload.recipientType !== undefined) {
    validateRecipientType(
      payload.recipientType,
      Alert.schema.path("recipientType").enumValues,
    );

    alert.recipientType = payload.recipientType.toUpperCase();
  }

  // Validate the subject and description length if they are being updated
  if (payload.subject !== undefined) validateDescLength(payload.subject, 200);
  if (payload.description !== undefined)
    validateDescLength(payload.description, 600);

  // If recipientType is being updated, we need to determine the new recipientId
  if (payload.recipientType !== undefined) {
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
      await deleteFromCloudinary(alert.attachmentPublicId, "raw");
    }

    // Upload the new file to cloudinary
    const uploaded = await uploadDocToCloudinary(
      file.buffer,
      file.originalname,
      "hrcom/alert_docs",
    );

    alert.attachmentURL = uploaded.secure_url;
    alert.attachmentPublicId = uploaded.public_id;
  } else if (
    payload.removeAttachment !== undefined &&
    Boolean(payload.removeAttachment) === true
  ) {
    if (alert.attachmentPublicId) {
      await deleteFromCloudinary(alert.attachmentPublicId, "raw");
    }

    alert.attachmentURL = "";
    alert.attachmentPublicId = "";
  }

  // Update allowed fields only
  if (payload.subject !== undefined) alert.subject = payload.subject;
  if (payload.description !== undefined)
    alert.description = payload.description;
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
      errors.ALERT_NOT_FOUND.suggestion,
    );
  }

  // Get the sender information for the notification after deletion
  const sender = await User.findById(alert.senderId);

  // Only the sender can delete
  if (sender._id.toString() !== user.id.toString()) {
    throw new AppError(
      "You are not allowed to delete this alert.",
      errors.FORBIDDEN_ACTION.code,
      errors.FORBIDDEN_ACTION.errorCode,
      "Only the sender can delete this alert.",
    );
  }

  // Only the NEW alerts can be deleted
  if (alert.status !== "NEW") {
    throw new AppError(
      "Only new alerts can be deleted.",
      errors.INVALID_STATUS.code,
      errors.INVALID_STATUS.errorCode,
      "You cannot delete an alert after it enters review.",
    );
  }

  // Delete the attachment if it exists
  if (alert.attachmentPublicId) {
    await deleteFromCloudinary(alert.attachmentPublicId, "raw");
  }

  await Alert.findByIdAndDelete(alertId);

  // Send a notification for all admins about the alert deletion
  try {
    await createNotificationForAdmins({
      type: "ALERT",
      title: "Alert deleted",
      message: `${sender.name} ${sender.lastName} has deleted an alert.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Failed to send notification for the alert deletion:", err);
  }

  return {
    status: "Success",
    code: 200,
    message: "Alert deleted successfully",
  };
};

// Get all alerts
export const getAlerts = async (queryParams, currentUser) => {
  const filter = {};

  // Supervisors can only see alerts addressed to them from their team members
  if (currentUser.role === "Supervisor") {
    filter.recipientType = "SUPERVISOR";
    filter.recipientId = currentUser.id;
  }

  // Administrators / HR can only see alerts addressed to HR Department
  if (currentUser.role === "Admin") {
    filter.recipientType = "HR_DEPARTMENT";
  }

  const mergedQueryParams = {
    ...queryParams,
    ...filter,
  };

  const result = await getAll(
    Alert,
    [
      { path: "senderId", select: "name lastName email" },
      { path: "recipientId", select: "name lastName email" },
      { path: "handledBy", select: "name lastName email" },
    ],
    null,
    ["subject", "description"],
  )(mergedQueryParams);

  // Deal with the anonymous alerts: If an alert is marked as anonymous, we keep the sender identity from the recipient
  result.data = result.data.map((alert) => {
    // Copy the alert object to avoid mutating the original Mongoose document
    const alertObject = alert.toObject();

    if (alertObject.isAnonymous) {
      alertObject.senderId = null;
    }

    return alertObject;
  });

  result.message = "Alerts retrieved successfully!";
  return result;
};

// Mark an alert as under review
export const markAlertUnderReview = async (alertId, currentUser, ip) => {
  // Check the alert existence
  const alert = await Alert.findById(alertId).populate(
    "senderId",
    "name lastName",
  );
  if (!alert) {
    throw new AppError(
      errors.ALERT_NOT_FOUND.message,
      errors.ALERT_NOT_FOUND.code,
      errors.ALERT_NOT_FOUND.errorCode,
      errors.ALERT_NOT_FOUND.suggestion,
    );
  }

  // ACCESS CONTROL
  validateAlertActionAccess(currentUser, alert);

  // Only alerts in NEW status can be moved to UNDER_REVIEW
  if (alert.status !== "NEW") {
    throw new AppError(
      errors.INVALID_STATUS_TRANSITION.message,
      errors.INVALID_STATUS_TRANSITION.code,
      errors.INVALID_STATUS_TRANSITION.errorCode,
      errors.INVALID_STATUS_TRANSITION.suggestion,
    );
  }

  // Update the alert status
  alert.status = "UNDER_REVIEW";
  alert.handledBy = currentUser.id;

  await alert.save();

  if (currentUser.role === "Admin") {
    // Create the audit log for this action
    try {
      await logAuditAction({
        adminId: currentUser.id,
        action: "MARK_ALERT_UNDER_REVIEW",
        targetType: "Alert",
        targetId: alert._id,
        targetName: `${alert.isSystemGenerated ? 'System Alert' : `${alert.senderId.name} ${alert.senderId.lastName}`}`,
        ipAddress: ip,
      });
    } catch (logErr) {
      console.log("[AUDIT-LOG-ERROR]", logErr.message);
    }
  }

  // Send a notification to the user about the alert being under review
  if (alert.isSystemGenerated === false) {
    try {
      await createNotification({
        recipientId: alert.senderId._id,
        type: "ALERT",
        title: "Alert under review",
        message: `Your alert: "${alert.subject}" has been marked as under review.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error("Failed to send notification for the alert creation:", err);
    }
  }

  return {
    status: "Success",
    code: 200,
    message: "Alert marked as under review successfully!",
    data: alert,
  };
};

// Resolve an alert
export const resolveAlert = async (
  alertId,
  payload, // { resolutionNote }
  currentUser,
  ip,
) => {
  // Check the alert existence
  const alert = await Alert.findById(alertId).populate(
    "senderId",
    "name lastName",
  );

  if (!alert) {
    throw new AppError(
      errors.ALERT_NOT_FOUND.message,
      errors.ALERT_NOT_FOUND.code,
      errors.ALERT_NOT_FOUND.errorCode,
      errors.ALERT_NOT_FOUND.suggestion,
    );
  }

  // ACCESS CONTROL
  validateAlertActionAccess(currentUser, alert);

  // Only alerts already under review can be resolved
  if (alert.status !== "UNDER_REVIEW") {
    throw new AppError(
      errors.INVALID_STATUS_TRANSITION.message,
      errors.INVALID_STATUS_TRANSITION.code,
      errors.INVALID_STATUS_TRANSITION.errorCode,
      "Only alerts under review can be resolved.",
    );
  }

  if (payload?.resolutionNote) {
    validateDescLength(payload.resolutionNote, 400);
    alert.resolutionNote = payload.resolutionNote;
  }

  alert.status = "RESOLVED";
  alert.resolvedAt = new Date();
  alert.handledBy = currentUser.id;

  await alert.save();

  // Create an audit log for this action
  if (currentUser.role === "Admin") {
    try {
      await logAuditAction({
        adminId: currentUser.id,
        action: "RESOLVE_ALERT",
        targetType: "Alert",
        targetId: alert._id,
        targetName: `${alert.isSystemGenerated ? 'System Alert' : `${alert.senderId.name} ${alert.senderId.lastName}`}`,
        ipAddress: ip,
      });
    } catch (logErr) {
      console.log("[AUDIT-LOG-ERROR]", logErr.message);
    }
  }

  if (alert.isSystemGenerated === false) {
    // Send a notification to the user about the alert being resolved
    try {
      await createNotification({
        recipientId: alert.senderId._id,
        type: "ALERT",
        title: "Alert Resolved",
        message: `Your alert: "${alert.subject}" has been resolved.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error(
        "Failed to send notification for the alert resolution:",
        err,
      );
    }
  }

  return {
    status: "Success",
    code: 200,
    message: "Alert resolved successfully!",
    data: alert,
  };
};

// Dismiss an alert
export const dismissAlert = async (alertId, payload, currentUser, ip) => {
  // Check alert existence
  const alert = await Alert.findById(alertId).populate(
    "senderId",
    "name lastName",
  );
  if (!alert) {
    throw new AppError(
      errors.ALERT_NOT_FOUND.message,
      errors.ALERT_NOT_FOUND.code,
      errors.ALERT_NOT_FOUND.errorCode,
      errors.ALERT_NOT_FOUND.suggestion,
    );
  }

  // ACCESS CONTROL
  validateAlertActionAccess(currentUser, alert);

  // Only alerts already under review can be dismissed
  if (alert.status !== "UNDER_REVIEW") {
    throw new AppError(
      errors.INVALID_STATUS_TRANSITION.message,
      errors.INVALID_STATUS_TRANSITION.code,
      errors.INVALID_STATUS_TRANSITION.errorCode,
      "Only alerts under review can be dismissed.",
    );
  }

  // Check the resolution note existence (required for dismissal)
  if (!payload.resolutionNote) {
    throw new AppError(
      errors.MISSING_RESOLUTION_NOTE.message,
      errors.MISSING_RESOLUTION_NOTE.code,
      errors.MISSING_RESOLUTION_NOTE.errorCode,
      errors.MISSING_RESOLUTION_NOTE.suggestion,
    );
  } else if (payload.resolutionNote) {
    validateDescLength(payload.resolutionNote, 400);
    alert.resolutionNote = payload.resolutionNote;
  }

  alert.status = "DISMISSED";
  alert.handledBy = currentUser.id;

  await alert.save();

  // Create the audit log for this action
  if (currentUser.role === "Admin") {
    try {
      await logAuditAction({
        adminId: currentUser.id,
        action: "DISMISS_ALERT",
        targetType: "Alert",
        targetId: alert._id,
        targetName: `${alert.isSystemGenerated ? 'System Alert' : `${alert.senderId.name} ${alert.senderId.lastName}`}`,
        ipAddress: ip,
      });
    } catch (err) {
      console.log("[AUDIT-LOG-ERROR]", err.message);
    }
  }

  if (alert.isSystemGenerated === false) {
    // Send a notification to the user about the alert being dismissed
    try {
      await createNotification({
        recipientId: alert.senderId._id,
        type: "ALERT",
        title: "Alert Dismissed",
        message: `Your alert: "${alert.subject}" has been dismissed.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error(
        "Failed to send notification for the alert dismissal:",
        err,
      );
    }
  }

  return {
    status: "Success",
    code: 200,
    message: "Alert dismissed successfully!",
    data: alert,
  };
};
