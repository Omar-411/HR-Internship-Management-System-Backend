import AppError from "../utils/AppError.js";
import { errors } from "../errors/documentErrors.js";

// Check if the document is a personal document
export const validatePersonalDocument = (documentTypeId, personalTypeId) => {
  if (documentTypeId.toString() !== personalTypeId.toString()) {
    throw new AppError(
      errors.NOT_PERSONAL_DOCUMENT.message,
      errors.NOT_PERSONAL_DOCUMENT.code,
      errors.NOT_PERSONAL_DOCUMENT.errorCode,
      errors.NOT_PERSONAL_DOCUMENT.suggestion,
    );
  }
};
