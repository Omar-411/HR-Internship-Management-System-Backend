import LeaveType from "../models/LeaveType.js";
import { errors } from "../errors/leaveTypeErrors.js";
import AppError from "../utils/AppError.js";

// Validate the leave type name
export const validateLeaveTypeName = (name) => {
  if (!name || name.trim() === "") {
    throw new AppError(
      errors.LEAVE_TYPE_NAME_REQUIRED.message,
      errors.LEAVE_TYPE_NAME_REQUIRED.code,
      errors.LEAVE_TYPE_NAME_REQUIRED.errorCode,
      errors.LEAVE_TYPE_NAME_REQUIRED.suggestion,
    );
  }

  // Normalize the leave type name
  return (
    name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase()
  );
};

// Validate the leave type default days
export const validateDefaultDays = (defaultDays) => {
  if (defaultDays === undefined || defaultDays < 0) {
    throw new AppError(
      errors.INVALID_DEFAULT_DAYS.message,
      errors.INVALID_DEFAULT_DAYS.code,
      errors.INVALID_DEFAULT_DAYS.errorCode,
      errors.INVALID_DEFAULT_DAYS.suggestion,
    );
  }
};

// Validate the leave type max days
export const validateMaxDays = (maxDays) => {
  if (maxDays === undefined || maxDays < 0) {
    throw new AppError(
      errors.INVALID_MAX_DAYS.message,
      errors.INVALID_MAX_DAYS.code,
      errors.INVALID_MAX_DAYS.errorCode,
      errors.INVALID_MAX_DAYS.suggestion,
    );
  }
};

// Validate the leave type gender
export const validateLeaveTypeGender = (gender) => {
  const allowedGenders = LeaveType.schema.path("gender").enumValues;
  if (!allowedGenders.includes(gender)) {
    throw new AppError(
      errors.INVALID_GENDER.message,
      errors.INVALID_GENDER.code,
      errors.INVALID_GENDER.errorCode,
      errors.INVALID_GENDER.suggestion,
    );
  }
};

// Validate the leave type deductFrom
export const validateLeaveTypeDeductFrom = (deductFrom) => {
  const allowedValues = LeaveType.schema.path("deductFrom").enumValues;
  if (!allowedValues.includes(deductFrom)) {
    throw new AppError(
      errors.INVALID_DEDUCT_FROM.message,
      errors.INVALID_DEDUCT_FROM.code,
      errors.INVALID_DEDUCT_FROM.errorCode,
      errors.INVALID_DEDUCT_FROM.suggestion,
    );
  }
};

// Check the leave type name existance
export const checkLeaveTypeNameExistence = async (name, id) => {
  const existingLeaveType = await LeaveType.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
    _id: { $ne: id },
  });

  if (existingLeaveType) {
    throw new AppError(
      errors.LEAVE_TYPE_ALREADY_EXISTS.message,
      errors.LEAVE_TYPE_ALREADY_EXISTS.code,
      errors.LEAVE_TYPE_ALREADY_EXISTS.errorCode,
      errors.LEAVE_TYPE_ALREADY_EXISTS.suggestion,
    );
  }
};
