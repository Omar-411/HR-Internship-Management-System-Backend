// Sensitive fields to exclude when returning user data 
export const SENSITIVE_FIELDS =
  "-password -verificationCode -verificationCodeExpires -resetPasswordToken -resetPasswordExpires -loginAttempts -resendCount -resendDate -mustResetPassword";

// Default salary values based on user roles (for new users and if no base salary is provided during user creation)
export const ROLE_SALARY_DEFAULTS = {
  employee: 1800,
  supervisor: 3500,
  admin: 5500,
};

// Intern-specific leave balances and allowed leave types
export const INTERN_ALLOWED = ["Annual Leave", "Sick Leave", "Personal"];

export const INTERN_DEFAULTS = {
  "Annual Leave": 13,
  "Sick Leave": 8,
  Personal: 3,
};
