export const errors = {
  ACCOUNT_INACTIVE: {
    message: "Your Account is Inactive. Contact administration.",
    code: 403,
    errorCode: "ACCOUNT_INACTIVE",
    suggestion: "Contact administration to activate your account.",
  },
  ACCOUNT_BLOCKED: {
    message: "Your Account is Blocked. Contact administration.",
    code: 403,
    errorCode: "ACCOUNT_BLOCKED",
    suggestion: "Contact administration to unblock your account.",
  },
  ACCOUNT_ALREADY_VERIFIED: {
    message: "Account is already verified!",
    code: 400,
    errorCode: "ACCOUNT_ALREADY_VERIFIED",
    suggestion: "You can log in with your credentials.",
  },
  INVALID_CREDENTIALS: {
    message: "Invalid Email or password!",
    code: 401,
    errorCode: "INVALID_CREDENTIALS",
    suggestion: "Check your email and password and try again.",
  },
  INVALID_OTP: {
    message: "Invalid OTP code!",
    code: 400,
    errorCode: "INVALID_OTP",
    suggestion: "Please check the OTP code and try again.",
  },
  OTP_EXPIRED: {
    message: "OTP code has expired!",
    code: 400,
    errorCode: "OTP_EXPIRED",
    suggestion: "Please request a new OTP code.",
  },
  MAX_RESEND_REACHED: {
    message: "Maximum OTP resend attempts reached for today.",
    code: 429,
    errorCode: "MAX_RESEND_REACHED",
    suggestion: "Please try again tomorrow or contact support.",
  },
  RESET_NOT_REQUIRED: {
    message: "Password reset is not required for this account.",
    code: 400,
    errorCode: "RESET_NOT_REQUIRED",
    suggestion: "You can log in with your current password.",
  },
  MISSING_PASSWORD: {
    message: "New password is required.",
    code: 400,
    errorCode: "MISSING_PASSWORD",
    suggestion: "Please provide a new password to reset.",
  },
  WEAK_PASSWORD: {
    message: "Password must be at least 8 characters long and contain at least one uppercase letter.",
    code: 400,
    errorCode: "WEAK_PASSWORD",
    suggestion: "Please choose a stronger password.",
  },
  INVALID_OR_EXPIRED_TOKEN: {
    // This error is for the expired token in the forget password process, not the middleware authentication message
    message: "Invalid or expired password reset token.",
    code: 401,
    errorCode: "INVALID_OR_EXPIRED_TOKEN",
    suggestion: "Please request a new password reset token.",
  },
};
