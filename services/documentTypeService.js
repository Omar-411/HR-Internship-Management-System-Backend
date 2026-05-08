import DocumentType from "../models/DocumentType.js";
import AppError from "../utils/AppError.js";
import { isEmpty } from "../validators/userValidators.js";
import { errors } from "../errors/documentTypeErrors.js";
import { getOne, getAll, createOne, updateOne } from "./handlersFactory.js";

// Create a new document type
export const createDocumentTypeService = async ({ name, description }) => {
  if (isEmpty(name)) {
    throw new AppError(
      errors.DOCUMENT_TYPE_NAME_REQUIRED.message,
      errors.DOCUMENT_TYPE_NAME_REQUIRED.code,
      errors.DOCUMENT_TYPE_NAME_REQUIRED.errorCode,
      errors.DOCUMENT_TYPE_NAME_REQUIRED.suggestion,
    );
  }

  const trimmedName = name.trim();
  const trimmedDescription = description ? description.trim() : "";

  // Check for document type name existence
  const existing = await DocumentType.findOne({ name: trimmedName });
  if (existing) {
    throw new AppError(
      errors.DOCUMENT_TYPE_ALREADY_EXISTS.message,
      errors.DOCUMENT_TYPE_ALREADY_EXISTS.code,
      errors.DOCUMENT_TYPE_ALREADY_EXISTS.errorCode,
      errors.DOCUMENT_TYPE_ALREADY_EXISTS.suggestion,
    );
  }

  const documentType = await createOne(DocumentType)({
    name: trimmedName,
    description: trimmedDescription,
  });

  return documentType;
};

// Get the list of all document types
export const getAllDocumentTypesService = async (queryParams) => {
  const finalQuery = {
    ...queryParams,
    limit: 5,
    sort: "-createdAt",
  };
  return await getAll(DocumentType)(finalQuery);
};

// Get a document type by Id
export const getDocumentTypeByIdService = getOne(
  DocumentType,
  errors.DOCUMENT_TYPE_NOT_FOUND,
);

// Update a document type
export const updateDocumentTypeService = async (id, { name, description }) => {
  const trimmedName = (name || "").trim();
  const trimmedDescription = description ? description.trim() : "";

  // Check the name field
  if (isEmpty(name)) {
    throw new AppError(
      errors.DOCUMENT_TYPE_NAME_REQUIRED.message,
      errors.DOCUMENT_TYPE_NAME_REQUIRED.code,
      errors.DOCUMENT_TYPE_NAME_REQUIRED.errorCode,
      errors.DOCUMENT_TYPE_NAME_REQUIRED.suggestion,
    );
  }

  // Check the document type existence
  const documentType = await DocumentType.findById(id);
  if (!documentType) {
    throw new AppError(
      errors.DOCUMENT_TYPE_NOT_FOUND.message,
      errors.DOCUMENT_TYPE_NOT_FOUND.code,
      errors.DOCUMENT_TYPE_NOT_FOUND.errorCode,
      errors.DOCUMENT_TYPE_NOT_FOUND.suggestion,
    );
  }

  // Check for document type name existence
  const existing = await DocumentType.findOne({
    name: trimmedName,
    _id: { $ne: id },
  });
  if (existing) {
    throw new AppError(
      errors.DOCUMENT_TYPE_ALREADY_EXISTS.message,
      errors.DOCUMENT_TYPE_ALREADY_EXISTS.code,
      errors.DOCUMENT_TYPE_ALREADY_EXISTS.errorCode,
      errors.DOCUMENT_TYPE_ALREADY_EXISTS.suggestion,
    );
  }

  // Update the document type
  const updatedDocumentType = await updateOne(DocumentType)(id, {
    name: trimmedName,
    description: trimmedDescription,
  });

  return updatedDocumentType;
};
