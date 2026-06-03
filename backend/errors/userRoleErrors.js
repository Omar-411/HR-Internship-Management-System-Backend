export const errors = {
  USER_ROLE_NOT_FOUND: {
    message: "User Role not found",
    code: 404,
    errorCode: "USER_ROLE_NOT_FOUND",
    suggestion: "Please check the validity of the user role.",
  },
  USER_ROLE_ALREADY_EXISTS: {
    message: "User Role already exists",
    code: 409,
    errorCode: "USER_ROLE_ALREADY_EXISTS",
    suggestion: "Please use a different user role name.",
  },
  USER_ROLE_NAME_REQUIRED: {
    message: "The name field must be filled!",
    code: 400,
    errorCode: "USER_ROLE_NAME_REQUIRED",
    suggestion: "Please provide a name for the user role.",
  },
};
