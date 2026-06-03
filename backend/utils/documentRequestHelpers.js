import Task from "../models/Task.js";
import Sprint from "../models/Sprint.js";
import { errors } from "../errors/documentRequestErrors.js";
import { errors as taskErrors } from "../errors/taskErrors.js";
import { errors as sprintErrors } from "../errors/sprintErrors.js";
import AppError from "../utils/AppError.js";

// Validate the document request scope
export const validateDocumentRequestScope = async (scope, sprintId, taskId, projectId) => {
  if (!["Sprint", "Backlog", "Project"].includes(scope)) {
    throw new AppError(
      errors.INVALID_DOCUMENT_REQUEST_SCOPE.message,
      errors.INVALID_DOCUMENT_REQUEST_SCOPE.code,
      errors.INVALID_DOCUMENT_REQUEST_SCOPE.errorCode,
      errors.INVALID_DOCUMENT_REQUEST_SCOPE.suggestion,
    );
  }
  
  if (scope === "Sprint" && !sprintId) {
    throw new AppError(
      errors.SPRINT_REQUIRED_FOR_SPRINT_SCOPE.message,
      errors.SPRINT_REQUIRED_FOR_SPRINT_SCOPE.code,
      errors.SPRINT_REQUIRED_FOR_SPRINT_SCOPE.errorCode,
      errors.SPRINT_REQUIRED_FOR_SPRINT_SCOPE.suggestion,
    );
  }

  if (scope === "Backlog" && !taskId) {
    throw new AppError(
      errors.TASK_REQUIRED_FOR_BACKLOG_SCOPE.message,
      errors.TASK_REQUIRED_FOR_BACKLOG_SCOPE.code,
      errors.TASK_REQUIRED_FOR_BACKLOG_SCOPE.errorCode,
      errors.TASK_REQUIRED_FOR_BACKLOG_SCOPE.suggestion,
    );
  }

  // Check the sprint existence
  if (sprintId) {
    const sprint = await Sprint.findById(sprintId);
    if (!sprint || sprint.projectId.toString() !== projectId.toString()) {
      throw new AppError(
        sprintErrors.SPRINT_NOT_FOUND.message,
        sprintErrors.SPRINT_NOT_FOUND.code,
        sprintErrors.SPRINT_NOT_FOUND.errorCode,
        sprintErrors.SPRINT_NOT_FOUND.suggestion,
      );
    }
  }

  if (taskId) {
    const task = await Task.findById(taskId);
    if (!task || task.projectId.toString() !== projectId.toString()) {
      throw new AppError(
        taskErrors.TASK_NOT_FOUND.message,
        taskErrors.TASK_NOT_FOUND.code,
        taskErrors.TASK_NOT_FOUND.errorCode,
        taskErrors.TASK_NOT_FOUND.suggestion,
      );
    }
  }
};
