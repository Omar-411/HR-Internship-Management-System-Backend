export const errors = {
  UNAUTHORIZED_TO_ADD_DOCUMENT_REQUEST: {
    message:
      "You are not authorized to add a document request to this project.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_ADD_DOCUMENT_REQUEST",
    suggestion:
      "Make sure you are a member of the project team before adding a document request.",
  },
  SPRINT_REQUIRED_FOR_SPRINT_SCOPE: {
    message: "Sprint must be provided when scope is 'Sprint'.",
    code: 400,
    errorCode: "SPRINT_REQUIRED_FOR_SPRINT_SCOPE",
    suggestion: "Provide a valid sprint ID when the scope is 'Sprint'.",
  },
  TASK_REQUIRED_FOR_BACKLOG_SCOPE: {
    message: "Task must be provided when scope is 'Backlog'.",
    code: 400,
    errorCode: "TASK_REQUIRED_FOR_BACKLOG_SCOPE",
    suggestion: "Provide a valid task ID when the scope is 'Backlog'.",
  },
  UNAUTHORIZED_TO_VIEW_DOCUMENT_REQUESTS: {
    message:
      "You are not authorized to view document request(s) for this project.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_VIEW_DOCUMENT_REQUESTS",
    suggestion:
      "Make sure you are a member of the project team before viewing document request(s).",
  },
  DOCUMENT_REQUEST_NOT_FOUND: {
    message: "Document request not found.",
    code: 404,
    errorCode: "DOCUMENT_REQUEST_NOT_FOUND",
    suggestion: "Check if the document request ID is correct and try again.",
  },
  UNAUTHORIZED_TO_UPDATE_DOCUMENT_REQUEST: {
    message: "You are not authorized to edit this document request.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_UPDATE_DOCUMENT_REQUEST",
    suggestion:
      "Only the creator of the document request can edit it. Make sure you are the creator and try again.",
  },
  DOCUMENT_REQUEST_FULLFILLED: {
    message: "Cannot edit a fulfilled document request.",
    code: 400,
    errorCode: "DOCUMENT_REQUEST_FULLFILLED",
    suggestion:
      "Fulfilled document requests cannot be edited. If you need to make changes, consider creating a new document request.",
  },
  UNAUTHORIZED_TO_DELETE_DOCUMENT_REQUEST: {
    message: "You are not authorized to delete this document request.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_DELETE_DOCUMENT_REQUEST",
    suggestion:
      "Only the creator of the document request can delete it. Make sure you are the creator and try again.",
  },
  DOCUMENT_REQUEST_FULLFILLED: {
    message: "Cannot delete a fulfilled document request.",
    code: 400,
    errorCode: "DOCUMENT_REQUEST_FULLFILLED",
    suggestion:
      "Fulfilled document requests cannot be deleted to preserve project documentation history.",
  },
  UNAUTHORIZED_TO_FULFILL_DOCUMENT_REQUEST: {
    message: "You are not authorized to fullfill the document request.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_FULFILL_DOCUMENT_REQUEST",
    suggestion:
      "Only the creator of the document request can mark a doc request it as fulfilled and any project member can upload a document to fulfill the request.",
  },
  INVALID_DOCUMENT_REQUEST_SCOPE: {
    message: "Invalid document request scope.",
    code: 400,
    errorCode: "INVALID_DOCUMENT_REQUEST_SCOPE",
    suggestion: "Scope must be one of 'Sprint', 'Backlog', or 'Project'.",
  },
  DOCUMENT_REQUEST_ALREADY_FULFILLED: {
    message: "This document request has already been fulfilled.",
    code: 400,
    errorCode: "DOCUMENT_REQUEST_ALREADY_FULFILLED",
    suggestion: "This document request is already fulfilled. No further action is needed.",
  },
};
