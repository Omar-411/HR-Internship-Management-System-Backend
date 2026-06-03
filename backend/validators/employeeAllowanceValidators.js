import { errors } from "../errors/employeeAllowanceErrors.js";
import AppError from "../utils/AppError.js";
import { parseDate } from "../utils/timeHelpers.js";

// Validate the effective dates
export const validateEffectiveDates = (effectiveFrom, effectiveTo = null) => {
  const effectiveFromDate = parseDate(effectiveFrom);
  const effectiveToDate = parseDate(effectiveTo);

  if (!effectiveFromDate) {
    throw new AppError(
      errors.INVALID_EFFECTIVE_FROM_DATE.message,
      errors.INVALID_EFFECTIVE_FROM_DATE.code,
      errors.INVALID_EFFECTIVE_FROM_DATE.errorCode,
      errors.INVALID_EFFECTIVE_FROM_DATE.suggestion,
    );
  }

  if (effectiveTo && !effectiveToDate) {
    throw new AppError(
      errors.INVALID_EFFECTIVE_TO_DATE.message,
      errors.INVALID_EFFECTIVE_TO_DATE.code,
      errors.INVALID_EFFECTIVE_TO_DATE.errorCode,
      errors.INVALID_EFFECTIVE_TO_DATE.suggestion,
    );
  }

  if (effectiveToDate && effectiveToDate <= effectiveFromDate) {
    throw new AppError(
      errors.INVALID_EFFECTIVE_DATES.message,
      errors.INVALID_EFFECTIVE_DATES.code,
      errors.INVALID_EFFECTIVE_DATES.errorCode,
      errors.INVALID_EFFECTIVE_DATES.suggestion,
    );
  }

  return { effectiveFromDate, effectiveToDate };
};
