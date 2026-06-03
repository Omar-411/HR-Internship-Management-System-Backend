export const errors = {
  MISSING_REQUIRED_FIELDS: {
    message:
      "Missing required fields.",
    code: 400,
    errorCode: "MISSING_REQUIRED_FIELDS",
    suggestion: "Please provide all required fields and try again.",
  },
  INVALID_INACTIVE_ALLOWANCE_TYPE: {
    message:
      "Invalid or inactive allowance type. Please provide a valid and active allowanceTypeId.",
    code: 400,
    errorCode: "INVALID_INACTIVE_ALLOWANCE_TYPE",
    suggestion:
      "Check the allowanceTypeId and ensure it corresponds to an active allowance type.",
  },
  INVALID_EFFECTIVE_FROM_DATE: {
    message: "Invalid effectiveFrom date. Please provide a valid date.",
    code: 400,
    errorCode: "INVALID_EFFECTIVE_FROM_DATE",
    suggestion: "Ensure the effectiveFrom field is a valid date string.",
  },
  INVALID_EFFECTIVE_TO_DATE: {
    message: "Invalid effectiveTo date. Please provide a valid date.",
    code: 400,
    errorCode: "INVALID_EFFECTIVE_TO_DATE",
    suggestion: "Ensure the effectiveTo field is a valid date string.",
  },
  INVALID_EFFECTIVE_DATES: {
    message:
      "Invalid effective dates. effectiveTo should be after effectiveFrom if provided.",
    code: 400,
    errorCode: "INVALID_EFFECTIVE_DATES",
    suggestion:
      "Check the effectiveFrom and effectiveTo fields. If effectiveTo is provided, it must be a date after effectiveFrom.",
  },
  ALLOWANCE_ALREADY_EXISTS: {
    message:
      "An active allowance of the same type already exists for this employee in the same period.",
    code: 409,
    errorCode: "ALLOWANCE_ALREADY_EXISTS",
    suggestion:
      "Check the employee's existing allowances and ensure there are no overlapping active allowances of the same type.",
  },
  ALLOWANCE_NOT_FOUND: {
    message: "Employee allowance not found",
    code: 404,
    errorCode: "ALLOWANCE_NOT_FOUND",
    suggestion: "Please check the allowance ID and try again.",
  },
  UNAUTHORIZED_EMPLOYEE_ALLOWANCE_ACTION: {
    message: "You are not authorized to perform this action on the employee allowance.",
    code: 403,
    errorCode: "UNAUTHORIZED_EMPLOYEE_ALLOWANCE_ACTION",
    suggestion: "Please check your permissions and try again.",
  },
  UNAUTHORIZED_TO_ASSIGN_ALLOWANCE_TO_INTERNS: {
    message: "You are not authorized to assign allowances to interns.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_ASSIGN_ALLOWANCE_TO_INTERNS",
    suggestion: "Allowances cannot be assigned to employees with an internship contract type.",
  },
};
