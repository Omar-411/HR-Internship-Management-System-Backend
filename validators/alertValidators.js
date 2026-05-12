import { errors } from "../errors/alertErrors.js";

// Validate the alertType value
export const validateAlertType = (alertType, alertEnumValues) => {
  if (!alertEnumValues.includes(alertType)) {
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
  if (!alertEnumValues.includes(recipientType)) {
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
