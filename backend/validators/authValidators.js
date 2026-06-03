import User from "../models/User.js";
import { errors } from "../errors/authErrors.js";
import AppError from "../utils/AppError.js";

// Check if the user account is inactive or blocked
export const validateUserStatus = (user) => {
  if (user.status === "Blocked") {
    throw new AppError(
      errors.ACCOUNT_BLOCKED.message,
      errors.ACCOUNT_BLOCKED.code,
      errors.ACCOUNT_BLOCKED.errorCode,
      errors.ACCOUNT_BLOCKED.suggestion,
    );
  }
  else if (user.status === "Inactive") {
    throw new AppError(
      errors.ACCOUNT_INACTIVE.message,
      errors.ACCOUNT_INACTIVE.code,
      errors.ACCOUNT_INACTIVE.errorCode,
      errors.ACCOUNT_INACTIVE.suggestion
    );
  }
};
