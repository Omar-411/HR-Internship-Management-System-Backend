export const errors = {
  DOCUMENT_TYPE_NOT_FOUND: {
    message: "Document type not found",
    code: 404,
    errorCode: "DOCUMENT_TYPE_NOT_FOUND",
    suggestion: "Please check the validity of the document type.",
  },
  DOCUMENT_TYPE_ALREADY_EXISTS: {
    message: "Document type already exists",
    code: 409,
    errorCode: "DOCUMENT_TYPE_ALREADY_EXISTS",
    suggestion: "Please use a different document type name.",
  },
  DOCUMENT_TYPE_NAME_REQUIRED: {
    message: "The name field must be filled!",
    code: 400,
    errorCode: "DOCUMENT_TYPE_NAME_REQUIRED",
    suggestion: "Please provide a name for the document type.",
  },
};
