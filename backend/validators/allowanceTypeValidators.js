import { errors } from "../errors/allowanceTypeErrors.js";
import AppError from "../utils/AppError.js";

// Validate default amount
export const validateDefaultAmount = (
  defaultAmount,
  errorObj = errors.ALLOWANCE_TYPE_INVALID_DEFAULT_AMOUNT,
) => {
  if (defaultAmount < 0) {
    throw new AppError(
      errorObj.message,
      errorObj.code,
      errorObj.errorCode,
      errorObj.suggestion,
    );
  }
};
