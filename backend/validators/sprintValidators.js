import { isEmpty } from "./userValidators.js";
import { errors } from "../errors/sprintErrors.js";
import AppError from "../utils/AppError.js";

// Validate the sprint fields
export const validateSprintFields = (
  sprintData,
  project,
  { isUpdate = false } = {},
) => {
  const { name, startDate, durationInWeeks } = sprintData;

  // Validate the name field
  if (!isUpdate || name !== undefined) {
    if (isEmpty(name)) {
      throw new AppError(
        errors.SPRINT_NAME_REQUIRED.message,
        errors.SPRINT_NAME_REQUIRED.code,
        errors.SPRINT_NAME_REQUIRED.errorCode,
        errors.SPRINT_NAME_REQUIRED.suggestion,
      );
    }
  }

  // Validate the start date field
  if (!isUpdate || startDate !== undefined) {
    if (isEmpty(startDate)) {
      throw new AppError(
        errors.SPRINT_START_DATE_REQUIRED.message,
        errors.SPRINT_START_DATE_REQUIRED.code,
        errors.SPRINT_START_DATE_REQUIRED.errorCode,
        errors.SPRINT_START_DATE_REQUIRED.suggestion,
      );
    }
  }

  // Validate the start date is a valid date and within the project duration
  const start = new Date(startDate);
  if (
    isNaN(start) ||
    (project.startDate && start < project.startDate) ||
    (project.dueDate && start > project.dueDate)
  ) {
    throw new AppError(
      errors.SPRINT_START_DATE_INVALID.message,
      errors.SPRINT_START_DATE_INVALID.code,
      errors.SPRINT_START_DATE_INVALID.errorCode,
      errors.SPRINT_START_DATE_INVALID.suggestion,
    );
  }

  // Validate the duration field
  if (!isUpdate || durationInWeeks !== undefined) {
    if (durationInWeeks === undefined || isNaN(durationInWeeks)) {
      throw new AppError(
        errors.SPRINT_DURATION_INVALID.message,
        errors.SPRINT_DURATION_INVALID.code,
        errors.SPRINT_DURATION_INVALID.errorCode,
        errors.SPRINT_DURATION_INVALID.suggestion,
      );
    }
  }

  if (![1, 2, 3, 4].includes(durationInWeeks)) {
    throw new AppError(
      errors.SPRINT_DURATION_INVALID.message,
      errors.SPRINT_DURATION_INVALID.code,
      errors.SPRINT_DURATION_INVALID.errorCode,
      errors.SPRINT_DURATION_INVALID.suggestion,
    );
  }
};
