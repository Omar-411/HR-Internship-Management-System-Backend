export const errors = {
  PAYROLL_NOT_FOUND: {
    message: "Payroll record not found.",
    code: 404,  
    errorCode: "PAYROLL_NOT_FOUND",
    suggestion: "Verify the payroll ID and try again."
  },
  PAYROLL_ALREADY_EXISTS: {
    message: "A payroll record for this employee and month already exists.",
    code: 409,
    errorCode: "PAYROLL_ALREADY_EXISTS",
    suggestion: "Check if a payroll record for this employee and month already exists before creating a new one."
  },
  INVALID_WORKED_DAYS: {
    message: "The number of worked days for the payroll calculation is invalid.",
    code: 400,
    errorCode: "INVALID_WORKED_DAYS",
    suggestion: "Ensure that the number of worked days is a positive integer and does not exceed the total days in the month."
  },
  INVALID_BASE_SALARY: {
    message: "The employee does not have a valid base salary for payroll calculation.",
    code: 400,
    errorCode: "INVALID_BASE_SALARY",
    suggestion: "Update the employee's salary information with a valid base salary and try again."
  },
  INVALID_MONTHLY_HOURS: {
    message: "Invalid standard monthly hours configuration for payroll calculation.",
    code: 400,
    errorCode: "INVALID_MONTHLY_HOURS",
    suggestion: "Check the payroll configuration for standard monthly hours and ensure it is set to a valid positive number."
  },
  UNAUTHORIZED_PAYROLL_ACCESS: {
    message: "You are not authorized to access this payroll record.",
    code: 403,
    errorCode: "UNAUTHORIZED_PAYROLL_ACCESS",
    suggestion: "Contact your administrator if you believe this is an error."
  },
  PAYROLL_NOT_DRAFT: {
    message: "Only payroll records in draft status can be updated.",
    code: 400,
    errorCode: "PAYROLL_NOT_DRAFT",
    suggestion: "Only payroll records that are in draft status can be modified. Please check the payroll status and try again."
  },
  PAYMENT_PROOF_REQUIRED: {
    message: "Payment proof attachment is required to mark payroll as paid.",
    code: 400,
    errorCode: "PAYMENT_PROOF_REQUIRED",
    suggestion: "Please attach a payment proof document when marking the payroll as paid."
  },
};