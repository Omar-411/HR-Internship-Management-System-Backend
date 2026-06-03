import { errors } from "../errors/alertErrors.js";
import AppError from "../utils/AppError.js";

// Validate the alertType value
export const validateAlertType = (alertType, alertEnumValues) => {
  if (!alertEnumValues.includes(alertType.toUpperCase())) {
    throw new AppError(
      errors.INVALID_ALERT_TYPE.message,
      errors.INVALID_ALERT_TYPE.code,
      errors.INVALID_ALERT_TYPE.errorCode,
      errors.INVALID_ALERT_TYPE.suggestion,
    );
  }
};

// Validate the recipientType value
export const validateRecipientType = (recipientType, alertEnumValues) => {
  if (!alertEnumValues.includes(recipientType.toUpperCase())) {
    throw new AppError(
      errors.INVALID_RECIPIENT_TYPE.message,
      errors.INVALID_RECIPIENT_TYPE.code,
      errors.INVALID_RECIPIENT_TYPE.errorCode,
      errors.INVALID_RECIPIENT_TYPE.suggestion,
    );
  }
};

// Validate the subject and description length
export const validateDescLength = (text, maxLength) => {
  if (text.length > maxLength) {
    throw new AppError(
      errors.EXCEEDS_MAX_LENGTH.message,
      errors.EXCEEDS_MAX_LENGTH.code,
      errors.EXCEEDS_MAX_LENGTH.errorCode,
      errors.EXCEEDS_MAX_LENGTH.suggestion,
    );
  }
};

// Validate if authorized
export const validateAlertActionAccess = (currentUser, alert) => {
  let isAuthorized = false;

  if (currentUser.role === "Supervisor") {
    isAuthorized =
      alert.recipientId &&
      alert.recipientId.toString() === currentUser.id.toString();
  }

  if (currentUser.role === "Admin") {
    isAuthorized = alert.recipientType === "HR_DEPARTMENT";
  }

  if (!isAuthorized) {
    throw new AppError(
      errors.FORBIDDEN_ACTION.message,
      errors.FORBIDDEN_ACTION.code,
      errors.FORBIDDEN_ACTION.errorCode,
      "Only the designated recipient can mark this alert as under review.",
    );
  }
};
