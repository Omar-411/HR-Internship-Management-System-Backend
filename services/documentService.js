import User from "../models/User.js";
import Document from "../models/Document.js";
import DocumentType from "../models/DocumentType.js";
import DocumentRequest from "../models/DocumentRequest.js";
import AppError from "../utils/AppError.js";
import { errors } from "../errors/documentErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors as documentTypeErrors } from "../errors/documentTypeErrors.js";
import crypto from "crypto";
import { 
  uploadDocumentCore, 
  deleteDocumentCore, 
  downloadDocumentCore, 
  consultDocumentCore, 
  getDocumentsCore 
} from "./documentCoreService.js";
import { validatePersonalDocument } from "../validators/documentValidators.js";
import { 
  getPersonalType, 
  getValidPersonalDocument, 
  getValidAdminDocument 
} from "../utils/documentHelper.js";
import { getIO } from "../socket.js";

// ---------------------------------------------------------------------- //
// -------------------- PERSONAL DOCUMENTS SERVICES --------------------- //
// ---------------------------------------------------------------------- //

// Upload a personal document service
export const uploadPersonalDocumentService = async ({
  targetUserId,
  uploaderId,
  file,
  title,
  isConfidential,
}) => {
  // Check if a file is uploaded
  if (!file) {
    throw new AppError(
      commonErrors.NO_FILE_UPLOADED.message,
      commonErrors.NO_FILE_UPLOADED.code,
      commonErrors.NO_FILE_UPLOADED.errorCode,
      commonErrors.NO_FILE_UPLOADED.suggestion,
    );
  }

  // Resolve user ID (supports slug, publicId, or _id)
  const user = await User.findOne({
    $or: [
      { publicId: targetUserId },
      { slug: targetUserId },
      ...(targetUserId.match(/^[a-f\d]{24}$/i) ? [{ _id: targetUserId }] : [])
    ]
  });

  if (!user) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  const resolvedId = user._id;

  // Get the Personal document type
  const personalType = await getPersonalType();

  // Compute the file hash for duplicate detection
  const fileHash = crypto
    .createHash("sha256")
    .update(file.buffer)
    .digest("hex");

  // Check for duplicate file for the same user and document type
  const existingDoc = await Document.findOne({ fileHash });
  if (existingDoc) {
    throw new AppError(
      errors.DUPLICATE_FILE.message,
      errors.DUPLICATE_FILE.code,
      errors.DUPLICATE_FILE.errorCode,
      errors.DUPLICATE_FILE.suggestion,
    );
  }

  // Upload the document to Cloudinary
  const fileData = await uploadDocumentCore(
    file,
    "hrcom/personal_docs/images",
    "hrcom/personal_docs/docs",
  );

  // DB Document creation
  const document = await Document.create({
    title: title || file.originalname,
    ...fileData,
    fileHash,
    documentType_id: personalType._id,
    user_id: resolvedId,
    uploadedBy: uploaderId,
    isConfidential,
  });

  return {
    status: "Success",
    code: 201,
    message: "Personal document uploaded successfully!",
    data: document,
  };
};

// Delete a personal document service
export const deletePersonalDocumentService = async ({ documentId }) => {
  // Validate the document existence and type
  const document = await getValidPersonalDocument(documentId);

  // Delete the document from Cloudinary and DB
  await deleteDocumentCore(document);

  return {
    status: "Success",
    code: 200,
    message: "Personal document deleted successfully!",
  };
};

// Download a personal document service
export const downloadPersonalDocumentService = async ({ documentId, res }) => {
  // Validate the document existence and type
  const document = await getValidPersonalDocument(documentId);

  return await downloadDocumentCore(document, res);
};

// Consult a personal document service
export const consultPersonalDocumentService = async ({ documentId }) => {
  // Validate the document existence and type
  const document = await getValidPersonalDocument(documentId);

  return await consultDocumentCore(document);
};

// Get all personal documents for a user (Filter: Confidentiality, Pagination)
export const getPersonalDocumentsService = async ({
  userId,
  queryParams,
  requester // To check if we allow seeing the confidential documents or not
}) => {
  // Resolve user ID (supports slug, publicId, or _id)
  const user = await User.findOne({
    $or: [
      { publicId: userId },
      { slug: userId },
      ...(userId.match(/^[a-f\d]{24}$/i) ? [{ _id: userId }] : [])
    ]
  });

  if (!user) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  const resolvedId = user._id;
  const personalType = await getPersonalType();

  // Convert isConfidential query param to boolean for the filter to work correctly
  let parsedQuery = { ...queryParams };
  if (parsedQuery.isConfidential !== undefined) {
    parsedQuery.isConfidential = parsedQuery.isConfidential === "true";
  }

  // Access Control
  const isOwner = requester.id === resolvedId.toString();
  const isAdmin = requester.role === "Admin";

  if (!isOwner && !isAdmin) {
    // Force that only non-confidential documents are retrieved for non-owners and non-admins
    parsedQuery.isConfidential = false;
  }

  const finalQuery = {
    ...parsedQuery,
    user_id: resolvedId,
    documentType_id: personalType._id,
    limit: 5,
    sort: "-createdAt", 
  };

  return getDocumentsCore(finalQuery);
};

// Toggle the personal document confidentiality: STILL NOT TESTED
export const toggleConfidentialityService = async ({ documentId }) => {
  // Validate the document existence and type
  const document = await getValidPersonalDocument(documentId);

  // Toggle the confidentiality status
  document.isConfidential = !document.isConfidential;
  await document.save();

  return {
    status: "Success",
    code: 200,
    message: "Personal document confidentiality toggled successfully!",
    data: document,
  };
};

// ---------------------------------------------------------------------- //
// ----------------- ADMINISTRATIVE DOCUMENTS SERVICES ------------------ //
// ---------------------------------------------------------------------- //

// Get all administrative documents
export const getAdminDocumentsService = async ({ queryParams }) => {
  const parsedQuery = { ...queryParams };

  // Get the personal document type object to exclude it later
  const personalType = await getPersonalType();

  // Support type=DocumentTypeName for filtering instead of documentType_id
  if (parsedQuery.type) {
    // Look for the corresponding document type ID based on the provided type name
    const type = await DocumentType.findOne({ name: parsedQuery.type });
    if (!type) {
      throw new AppError(
        documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.message,
        documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.code,
        documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.errorCode,
        documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.suggestion,
      );
    }

    // If the type is not Personal, we proceed with the filtering
    if (type._id.toString() !== personalType._id.toString()) {
      parsedQuery.documentType_id = type._id;
      delete parsedQuery.type;

      return getDocumentsCore(parsedQuery);
    }
  }

  // Otherwise (General case): Exclude the personal documents
  parsedQuery.documentType_id = {
    $ne: personalType._id,
  };
  return getDocumentsCore(parsedQuery);
};

// Upload an administrative document service
export const uploadAdminDocumentService = async ({
  file,
  title,
  documentTypeId,
  uploadedBy,
}) => {
  if (!file) {
    throw new AppError(
      commonErrors.NO_FILE_UPLOADED.message,
      commonErrors.NO_FILE_UPLOADED.code,
      commonErrors.NO_FILE_UPLOADED.errorCode,
      commonErrors.NO_FILE_UPLOADED.suggestion,
    );
  }

  const type = await DocumentType.findById(documentTypeId);
  if (!type) {
    throw new AppError(
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.message,
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.code,
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.errorCode,
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.suggestion,
    );
  }

  // Compute the file hash for duplicate detection
  const fileHash = crypto
    .createHash("sha256")
    .update(file.buffer)
    .digest("hex");

  // Check for duplicate file 
  const existingDoc = await Document.findOne({ fileHash });
  if (existingDoc) {
    throw new AppError(
      errors.DUPLICATE_FILE.message,
      errors.DUPLICATE_FILE.code,
      errors.DUPLICATE_FILE.errorCode,
      errors.DUPLICATE_FILE.suggestion,
    );
  }

  const fileData = await uploadDocumentCore(
    file,
    "hrcom/admin_docs/images",
    "hrcom/admin_docs/docs"
  );

  const document = await Document.create({
    title: title || file.originalname,
    ...fileData,
    documentType_id: type._id,
    uploadedBy,
    user_id: null,
    projectId: null,
    isConfidential: false, 
    fileHash,
  });

  return {
    status: "Success",
    code: 201,
    message: "Administrative document uploaded successfully!",
    data: document,
  };
};

// Delete an administrative document service
export const deleteAdminDocumentService = async ({ documentId }) => {
  const document = await Document.findById(documentId);
  if (!document) throw new AppError(
    commonErrors.DOCUMENT_NOT_FOUND.message,
    commonErrors.DOCUMENT_NOT_FOUND.code,
    commonErrors.DOCUMENT_NOT_FOUND.errorCode,
    commonErrors.DOCUMENT_NOT_FOUND.suggestion,
  );

  await deleteDocumentCore(document);

  return {
    status: "Success",
    message: "Administrative document deleted successfully!",
    code: 200,
  };
};

// Download a personal document service
export const downloadAdminDocumentService = async ({ documentId, res }) => {
  // Validate the document existence and type
  const document = await getValidAdminDocument(documentId);

  await downloadDocumentCore(document, res);

  return {
    status: "Success",
    code: 200,
    message: "Administrative document downloaded successfully!",
  };
};

// Consult a personal document service
export const consultAdminDocumentService = async ({ documentId }) => {
  // Validate the document existence and type
  const document = await getValidAdminDocument(documentId);

  return await consultDocumentCore(document);
};

// ---------------------------------------------------------------------- //
// -------------------- DOCUMENT REQUESTS SERVICES ---------------------- //
// ---------------------------------------------------------------------- //

// Upload a document to fulfill a document request service
export const fulfillDocumentRequestService = async (id, file, userId) => {
  if (!file) {
    throw new AppError(
      commonErrors.NO_FILE_UPLOADED.message,
      commonErrors.NO_FILE_UPLOADED.code,
      commonErrors.NO_FILE_UPLOADED.errorCode,
      commonErrors.NO_FILE_UPLOADED.suggestion,
    );
  }

  // Handle frontend string IDs vs MongoDB ObjectIds
  let docRequest;
  if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
    docRequest = await DocumentRequest.findById(id);
  } else {
    docRequest = await DocumentRequest.findOne({ 
      $or: [{ docId: id }, { requestId: id }] 
    });
  }

  // If we still can't find it and the frontend passed a local ID, we shouldn't crash the backend.
  // We'll proceed to upload and return the file URL.
  
  const fileData = await uploadDocumentCore(
    file,
    "hrcom/project_docs/images",
    "hrcom/project_docs/docs",
  );

  if (docRequest) {
    docRequest.fileURL = fileData.fileURL;
    docRequest.fileName = file.originalname;
    docRequest.public_id = fileData.filePublicId; // Fix: uploadDocumentCore returns filePublicId
    docRequest.status = "in_review";
    docRequest.fulfilledBy = userId;
    
    console.log(`[DocumentService] Fulfilling request ${id}. Setting fulfilledBy to: ${userId}`);
    await docRequest.save();

    // Populate for real-time frontend display
    await docRequest.populate([
      { path: "requestedBy", select: "name email" },
      { path: "fulfilledBy", select: "name email" },
      { path: "sprintId", select: "name" },
      { path: "taskId", select: "title" }
    ]);
    
    console.log(`[DocumentService] Populated docRequest fulfilledBy:`, docRequest.fulfilledBy);

    // Emit socket event for real-time update
    try {
      const io = getIO();
      if (io) {
        const projectRoom = `project:${docRequest.projectId}`;
        io.to(projectRoom).emit("documentRequestUpdated", {
          projectId: String(docRequest.projectId),
          document: docRequest
        });
      }
    } catch (socketErr) {
      console.error("[Socket] Failed to emit documentRequestUpdated:", socketErr);
    }
  }

  return {
    status: "Success",
    code: 200,
    message: docRequest ? "Document request fulfilled successfully!" : "File uploaded to Cloudinary",
    data: docRequest || { fileURL: fileData.fileURL, fileName: file.originalname, public_id: fileData.filePublicId },
  };
};

