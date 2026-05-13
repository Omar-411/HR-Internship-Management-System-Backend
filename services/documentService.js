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
  getDocumentsCore,
  generateDocumentCore,
} from "./documentCoreService.js";
import { validatePersonalDocument } from "../validators/documentValidators.js";
import {
  getPersonalType,
  getValidPersonalDocument,
  getValidAdminDocument,
  resolveDocumentRequest,
} from "../utils/documentHelper.js";
import { getIO } from "../socket.js";
import { uploadDocToCloudinary } from "../utils/cloudinaryHelper.js";
import { TEMPLATE_DOCUMENT_TYPES } from "../constants/documentConstants.js";
import { slugify } from "../utils/documentHelper.js";
import { sendEmail } from "../utils/sendEmail.js";
import { logAuditAction } from "../utils/logger.js";
import { errors as documentRequestErrors } from "../errors/documentRequestErrors.js";
import { createNotification } from "./notificationService.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";

// ---------------------------------------------------------------------- //
// -------------------- PERSONAL DOCUMENTS SERVICES --------------------- //
// ---------------------------------------------------------------------- //

// Upload a personal document service
export const uploadPersonalDocumentService = async ({
  targetUserId,
  uploader,
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

  // Check the user existence
  const user = await User.findById(targetUserId);
  if (!user) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

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
    user_id: targetUserId,
    uploadedBy: uploader.id,
    isConfidential,
  });

  // Notify the user if the Admin uploaded a personal document to a user profile
  if (
    uploader.role === "Admin" &&
    uploader.id.toString() !== targetUserId.toString()
  ) {
    try {
      await createNotification({
        recipientId: targetUserId,
        type: "PERSONAL_DOCUMENT",
        title: "New Personal Document Uploaded",
        message: `A new personal document "${document.title}" has been added to your profile by the HR department.`,
        data: {
          entityType: "USER",
          entityId: targetUserId,
        },
      });
    } catch (err) {
      console.error(
        "Failed to send notification for new personal document upload:",
        err,
      );
    }
  }

  return {
    status: "Success",
    code: 201,
    message: "Personal document uploaded successfully!",
    data: document,
  };
};

// Delete a personal document service
export const deletePersonalDocumentService = async ({
  documentId,
  currentUser,
}) => {
  // Validate the document existence and type
  const document = await getValidPersonalDocument(documentId);

  // Get the target user to notify them later if an admin deleted one of their personal documents
  const targetUserId = document.user_id;
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Delete the document from Cloudinary and DB
  await deleteDocumentCore(document);

  // Notify the user if an admin deleted the document
  if (
    currentUser.role === "Admin" &&
    currentUser.id.toString() !== targetUserId.toString()
  ) {
    try {
      await createNotification({
        recipientId: targetUserId,
        type: "PERSONAL_DOCUMENT",
        title: "Personal Document Deleted",
        message: `Your personal document "${document.title}" has been removed by the HR department.`,
        data: {
          entityType: "USER",
          entityId: targetUserId,
        },
      });
    } catch (err) {
      console.error(
        "Failed to send notification for personal document deletion:",
        err,
      );
    }
  }

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
  requester, // To check if we allow seeing the confidential documents or not
}) => {
  const personalType = await getPersonalType();

  // Convert isConfidential query param to boolean for the filter to work correctly
  let parsedQuery = { ...queryParams };
  if (parsedQuery.isConfidential !== undefined) {
    parsedQuery.isConfidential = parsedQuery.isConfidential === "true";
  }

  // Access Control
  const isOwner = requester.id === userId;
  const isAdmin = requester.role === "Admin";

  if (!isOwner && !isAdmin) {
    // Force that only non-confidential documents are retrieved for non-owners and non-admins
    parsedQuery.isConfidential = false;
  }

  const finalQuery = {
    ...parsedQuery,
    user_id: userId,
    documentType_id: personalType._id,
    limit: 5,
    sort: "-createdAt",
  };

  return getDocumentsCore(finalQuery);
};

// Toggle the personal document confidentiality
export const toggleConfidentialityService = async ({
  documentId,
  currentUser,
}) => {
  // Validate the document existence and type
  const document = await getValidPersonalDocument(documentId);

  // Toggle the confidentiality status
  document.isConfidential = !document.isConfidential;
  await document.save();

  // Get the target user for notifications purposes
  const targetUserId = document.user_id;

  // Notify the user if the admin changed the document confidentiality
  if (
    currentUser.role === "Admin" &&
    currentUser.id.toString() !== targetUserId.toString()
  ) {
    await createNotification({
      recipientId: targetUserId,
      type: "PERSONAL_DOCUMENT",
      title: "Document Confidentiality Updated",
      message: `The confidentiality setting of your document "${document.title}" has been ${
        document.isConfidential ? "enabled" : "disabled"
      } by the HR department.`,
      data: {
        entityType: "USER",
        entityId: targetUserId,
      },
    });
  }

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
  ip,
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
    "hrcom/admin_docs/docs",
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

  // Create the audit log for this action
  await logAuditAction({
    adminId: uploadedBy,
    action: "UPLOAD_ADMIN_DOCUMENT",
    targetType: "Document",
    targetId: document._id,
    targetName: document.title,
    details: document,
    ipAddress: ip,
  });

  // Notify all admins except the uploader about the new administrative document upload
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: uploadedBy,
      type: "ADMINISTRATIVE_DOCUMENT",
      title: "New Administrative Document Uploaded",
      message: `A new document "${document.title}" has been uploaded.`,
      data: {
        entityType: "DOCUMENT",
        entityId: document._id,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for administrative document upload:",
      err,
    );
  }

  return {
    status: "Success",
    code: 201,
    message: "Administrative document uploaded successfully!",
    data: document,
  };
};

// Delete an administrative document service
export const deleteAdminDocumentService = async ({
  documentId,
  currentUser,
  ip,
}) => {
  const document = await Document.findById(documentId);
  if (!document)
    throw new AppError(
      commonErrors.DOCUMENT_NOT_FOUND.message,
      commonErrors.DOCUMENT_NOT_FOUND.code,
      commonErrors.DOCUMENT_NOT_FOUND.errorCode,
      commonErrors.DOCUMENT_NOT_FOUND.suggestion,
    );

  await deleteDocumentCore(document);

  // Create the audit log for this action
  await logAuditAction({
    adminId: currentUser.id,
    action: "DELETE_ADMIN_DOCUMENT",
    targetType: "Document",
    targetId: document._id,
    targetName: document.title,
    details: document,
    ipAddress: ip,
  });

  // Notify all admins (except the deleter) about the deleted administrative document
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: currentUser.id,
      type: "ADMINISTRATIVE_DOCUMENT",
      title: "Administrative Document Deleted",
      message: `The administrative document "${document.title}" has been deleted.`,
      data: {
        entityType: "DOCUMENT",
        entityId: document._id,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for administrative document deletion:",
      err,
    );
  }

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

// Generate an administrative document from a template service
export const generateDocumentService = async ({
  templateName,
  data,
  uploadedBy,
  ip,
}) => {
  // Check the user existence
  if (!data.userId) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  const user = await User.findById(data.userId);
  if (!user) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Validate the document type existence
  const documentTypeName = TEMPLATE_DOCUMENT_TYPES[templateName];
  if (!documentTypeName) {
    throw new AppError(
      errors.UNKNOWN_TEMPLATE_TYPE.message,
      errors.UNKNOWN_TEMPLATE_TYPE.code,
      errors.UNKNOWN_TEMPLATE_TYPE.errorCode,
      errors.UNKNOWN_TEMPLATE_TYPE.suggestion,
    );
  }

  // Get the document type object based on the template name
  const type = await DocumentType.findOne({ name: documentTypeName });
  if (!type) {
    throw new AppError(
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.message,
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.code,
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.errorCode,
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.suggestion,
    );
  }

  // Generate the PDF template buffer (buffer = the file in memory before uploading it to Cloudinary)
  const pdfBuffer = await generateDocumentCore(templateName, data);

  // Create the personnalised filename
  const safeName = slugify(
    data.full_name
      ? data.full_name
      : data.employee.name
        ? `${data.employee.name} ${data.employee.lastName}`
        : "",
  );
  const timestamp = new Date(Date.now())
    .toLocaleDateString("fr-FR")
    .replace(/\//g, "-");
  const fileName = `${templateName}-${safeName}-${timestamp}.pdf`;

  // Create the virtual file object: Transform the buffer into a multer file-like object that can be processed by the uploadDocumentCore function
  const virtualFile = {
    buffer: pdfBuffer,
    originalname: fileName,
    mimetype: "application/pdf",
    size: pdfBuffer.length,
  };

  const folderName =
    documentTypeName === "Report" ? "payslips" : "generated_docs";

  // Generate the file hash for duplicate detection
  const fileHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  // Upload the file to Cloudinary
  const fileData = await uploadDocumentCore(
    virtualFile,
    `hrcom/${folderName}/images`,
    `hrcom/${folderName}/docs`,
  );

  // Save document
  const document = await Document.create({
    title: fileName,
    ...fileData,
    fileHash,
    documentType_id: type._id,
    uploadedBy,
    user_id: data.userId,
    projectId: null,
    isConfidential: true,
  });

  // Create the audit log for this action
  await logAuditAction({
    adminId: uploadedBy,
    action: "GENERATE_DOCUMENT",
    targetType: "Document",
    targetId: document._id,
    targetName: document.title,
    details: document,
    ipAddress: ip,
  });

  // Notify all other admins that a document was generated
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: uploadedBy,
      type: "ADMINISTRATIVE_DOCUMENT",
      title: "New Document Generated",
      message: `A new generated document "${document.title}" has been created for ${user.name} ${user.lastName}.`,
      data: {
        entityType: "DOCUMENT",
        entityId: document._id,
      },
    });
  } catch (err) {
    console.error("Failed to send notification for document generation:", err);
  }

  return {
    status: "Success",
    code: 201,
    message: "Document generated successfully!",
    data: document.fileURL,
  };
};

// Send the generated document by email to user
export const sendGeneratedDocumentByEmailService = async ({
  documentId,
  currentUser,
  ip,
}) => {
  // Check the document existence
  const document = await Document.findById(documentId);
  if (!document) {
    throw new AppError(
      commonErrors.DOCUMENT_NOT_FOUND.message,
      commonErrors.DOCUMENT_NOT_FOUND.code,
      commonErrors.DOCUMENT_NOT_FOUND.errorCode,
      commonErrors.DOCUMENT_NOT_FOUND.suggestion,
    );
  }

  // Get the user to retrieve the email
  const user = await User.findById(document.user_id);
  if (!user) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Download file as buffer
  const { buffer, fileName, mimeType } = await downloadDocumentCore(document);

  // Send email with attachment
  await sendEmail({
    to: user.email,
    subject: `Generated Document Sent`,
    type: "document",
    name: `${user.name}`,
    documentTitle: document.title,
    attachments: [
      {
        filename: fileName,
        content: buffer,
        contentType: mimeType,
      },
    ],
  });

  // Create the audit log for this action
  await logAuditAction({
    adminId: currentUser.id,
    action: "SEND_GENERATED_DOCUMENT_BY_EMAIL",
    targetType: "Document",
    targetId: document._id,
    targetName: document.title,
    details: {
      documentId: document._id,
      templateName: document.templateName,
      userEmail: user.email,
    },
    ipAddress: ip,
  });

  // Notify the user that a generated document was sent by email
  try {
    await createNotification({
      recipientId: user._id,
      type: "ADMINISTRATIVE_DOCUMENT",
      title: "Generated Document Sent by Email",
      message: `A generated document "${document.title}" has been sent to your email address.`,
      data: {
        entityType: "DOCUMENT",
        entityId: document._id,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for generated document email:",
      err,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Document sent successfully by email!",
    data: {
      documentId: document._id,
      userEmail: user.email,
    },
  };
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

  // Validate the document request existence and get its details
  const docRequest = await resolveDocumentRequest(id);

  // Check if the request is already fulfilled
  if (docRequest.status === "Fulfilled") {
    throw new AppError(
      documentRequestErrors.DOCUMENT_REQUEST_ALREADY_FULFILLED.message,
      documentRequestErrors.DOCUMENT_REQUEST_ALREADY_FULFILLED.code,
      documentRequestErrors.DOCUMENT_REQUEST_ALREADY_FULFILLED.errorCode,
      documentRequestErrors.DOCUMENT_REQUEST_ALREADY_FULFILLED.suggestion,
    );
  }

  // Upload the document to Cloudinary
  const fileData = await uploadDocumentCore(
    file,
    "hrcom/project_docs/images",
    "hrcom/project_docs/docs",
  );

  if (docRequest) {
    docRequest.fileURL = fileData.fileURL;
    docRequest.fileName = file.originalname;
    docRequest.public_id = fileData.filePublicId;
    docRequest.status = "in_review";
    docRequest.fulfilledBy = userId;
    docRequest.rejectionComment = null;

    console.log(
      `[DocumentService] Fulfilling request ${id}. Setting fulfilledBy to: ${userId}`,
    );
    await docRequest.save();

    // Populate for frontend display
    await docRequest.populate([
      { path: "requestedBy", select: "name email" },
      { path: "fulfilledBy", select: "name email" },
      { path: "sprintId", select: "name" },
      { path: "taskId", select: "title" },
    ]);

    console.log(
      `[DocumentService] Populated docRequest fulfilledBy:`,
      docRequest.fulfilledBy,
    );

    // Emit socket event for real-time update
    try {
      const io = getIO();
      if (io) {
        const projectRoom = `project:${docRequest.projectId}`;
        io.to(projectRoom).emit("documentRequestUpdated", {
          projectId: String(docRequest.projectId),
          document: docRequest,
        });
      }
    } catch (socketErr) {
      console.error(
        "[Socket] Failed to emit documentRequestUpdated:",
        socketErr,
      );
    }
  }

  return {
    status: "Success",
    code: 200,
    message: docRequest
      ? "Document request fulfilled successfully!"
      : "File uploaded to Cloudinary",
    data: docRequest || {
      fileURL: fileData.fileURL,
      fileName: file.originalname,
      public_id: fileData.filePublicId,
    },
  };
};
