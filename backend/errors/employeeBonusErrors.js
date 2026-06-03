export const errors = {
  BONUS_NOT_FOUND: {
    message: "Employee bonus not found",
    code: 404,
    errorCode: "EMPLOYEE_BONUS_NOT_FOUND",
    suggestion: "Verify the bonus ID and try again",
  },
  UNAUTHORIZED_EMPLOYEE_BONUS_ACTION: {
    message:
      "You are not authorized to perform this action on the employee bonus.",
    code: 403,
    errorCode: "UNAUTHORIZED_EMPLOYEE_BONUS_ACTION",
    suggestion: "Please check your permissions and try again.",
  },
  UNAUTHORIZED_TO_ASSIGN_BONUS_TO_INTERNS: {
    message: "You are not authorized to assign bonuses to interns.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_ASSIGN_BONUS_TO_INTERNS",
    suggestion: "Please check your permissions and try again.",
  },
  INVALID_INACTIVE_BONUS_TYPE: {
    message:
      "Invalid or inactive bonus type. Please provide a valid and active bonusTypeId.",
    code: 400,
    errorCode: "INVALID_INACTIVE_BONUS_TYPE",
    suggestion:
      "Check the bonusTypeId and ensure it corresponds to an active bonus type.",
  },
  BONUS_ALREADY_EXISTS: {
    message:
      "An active bonus of the same type already exists for this employee in the same period.",
    code: 409,
    errorCode: "BONUS_ALREADY_EXISTS",
    suggestion:
      "Check the employee's existing bonuses and ensure there are no overlapping active bonuses of the same type.",
  },
};
