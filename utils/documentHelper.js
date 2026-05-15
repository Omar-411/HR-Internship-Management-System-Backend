import Document from "../models/Document.js";
import DocumentType from "../models/DocumentType.js";
import DocumentRequest from "../models/DocumentRequest.js";
import AppError from "../utils/AppError.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors } from "../errors/documentErrors.js";
import { validatePersonalDocument } from "../validators/documentValidators.js";

// Helper function to return to us the Personal document type
export const getPersonalType = async () => {
  const type = await DocumentType.findOne({ name: "Personal" });
  if (!type) {
    throw new AppError(
      errors.PERSONAL_TYPE_NOT_FOUND.message,
      errors.PERSONAL_TYPE_NOT_FOUND.code,
      errors.PERSONAL_TYPE_NOT_FOUND.errorCode,
      errors.PERSONAL_TYPE_NOT_FOUND.suggestion,
    );
  }
  return type;
};

// Helper function to validate the document existence and type
export const getValidPersonalDocument = async (DocumentId) => {
  // Get the Personal document type
  const personalType = await getPersonalType();

  // Get the document from the DB
  const document = await Document.findById(DocumentId);
  if (!document) {
    throw new AppError(
      commonErrors.DOCUMENT_NOT_FOUND.message,
      commonErrors.DOCUMENT_NOT_FOUND.code,
      commonErrors.DOCUMENT_NOT_FOUND.errorCode,
      commonErrors.DOCUMENT_NOT_FOUND.suggestion,
    );
  }

  // Validate the document existence and type
  validatePersonalDocument(document.documentType_id, personalType._id);

  return document;
};

// Helper function to check if a document is an administrative document (WE CAN ADD LATER ABOUT THE PROJECT DOC HERE)
export const getValidAdminDocument = async (DocumentId) => {
  // Get the Personal document type
  const personalType = await getPersonalType();

  // Get the document from the DB
  const document = await Document.findById(DocumentId);
  if (!document) {
    throw new AppError(
      commonErrors.DOCUMENT_NOT_FOUND.message,
      commonErrors.DOCUMENT_NOT_FOUND.code,
      commonErrors.DOCUMENT_NOT_FOUND.errorCode,
      commonErrors.DOCUMENT_NOT_FOUND.suggestion,
    );
  }

  // If the document type is not Personal, then it's an administrative document
  if (document.documentType_id.toString() === personalType._id.toString()) {
    throw new AppError(
      errors.NOT_ADMINISTRATIVE_DOCUMENT.message,
      errors.NOT_ADMINISTRATIVE_DOCUMENT.code,
      errors.NOT_ADMINISTRATIVE_DOCUMENT.errorCode,
      errors.NOT_ADMINISTRATIVE_DOCUMENT.suggestion,
    );
  }
  return document;
};

// Fill a html template with data
// export const fillTemplate = (html, data) => {
//   return Object.keys(data).reduce((result, key) => {
//     const value = data[key] ?? "";

//     // Replace all occurrences of {{key}} in the template with the corresponding value from the data object
//     return result.replaceAll(`{{${key}}}`, value);
//   }, html);
// };

export const fillTemplate = (html, data) => {
  const getValue = (obj, path) => {
    return path.split(".").reduce((acc, key) => {
      return acc ? acc[key] : "";
    }, obj);
  };

  return html.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
    const value = getValue(data, key.trim());
    return value ?? "";
  });
};


// A slugify function to generate URL-friendly strings from document titles (slugify = convert "My Document Title" to "my-document-title")
export const slugify = (text) => {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]/g, ""); // Remove all non-word chars except -. Ex: "my-document-title!" becomes "my-document-title"
};

// Resolve a document request to get the document URL for viewing
export const resolveDocumentRequest = async (id) => {
  if (!id) return null;

  // Check if the provided ID is a valid MongoDB ObjectId
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  if (isObjectId) {
    return await DocumentRequest.findById(id);
  }

  return await DocumentRequest.findOne({
    $or: [{ docId: id }, { requestId: id }],
  });
};

// Helper function to find a document type by name
export const findType = (documentTypes, name) => {
  return documentTypes.find(
    (type) => type.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
};
