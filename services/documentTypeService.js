import DocumentType from "../models/DocumentType.js";
import AppError from "../utils/AppError.js";
import { isEmpty } from "../validators/userValidators.js";
import { errors } from "../errors/documentTypeErrors.js";
import { getOne, getAll, createOne, updateOne } from "./handlersFactory.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";

// Create a new document type
export const createDocumentTypeService = async (
  { name, description },
  currentUser,
) => {
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

  // Notify all admins except the one who created the role
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: currentUser.id,
      type: "DOCUMENT_TYPE",
      title: "New Document Type Created",
      message: `A new document type "${trimmedName}" has been created.`,
      data: {
        entityType: "DocumentType",
        entityId: documentType.data._id,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for new document type creation:",
      err,
    );
  }

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
export const updateDocumentTypeService = async (
  id,
  { name, description },
  currentUser,
) => {
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

  // Store the old document type name for notification message
  const oldDocumentTypeName = documentType.name;

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

  // Notify all admins except the one who updated the document type
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: currentUser.id,
      type: "DOCUMENT_TYPE",
      title: "Document Type Updated",
      message: `The document type "${oldDocumentTypeName}" has been updated.`,
      data: {
        entityType: "DocumentType",
        entityId: updatedDocumentType.data._id,
      },
    });
  } catch (err) {
    console.error("Failed to send notification for document type update:", err);
  }

  return updatedDocumentType;
};
