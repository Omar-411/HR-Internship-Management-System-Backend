import User from "../models/User.js";
import Document from "../models/Document.js";
import DocumentType from "../models/DocumentType.js";
import DocumentRequest from "../models/DocumentRequest.js";
import Project from "../models/Project.js";
import Team from "../models/Team.js";
import TeamMember from "../models/TeamMember.js";
import { errors as documentTypeErrors } from "../errors/documentTypeErrors.js";
import { errors } from "../errors/documentRequestErrors.js";
import { errors as projectErrors } from "../errors/projectErrors.js";
import { errors as documentErrors } from "../errors/documentErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import AppError from "../utils/AppError.js";
import {
  uploadDocumentCore,
  downloadDocumentCore,
  deleteDocumentCore,
  consultDocumentCore,
} from "./documentCoreService.js";
import { getAll } from "./handlersFactory.js";
import { createNotification } from "./notificationService.js";

// Upload a document to fulfill a document request (Every member of the project team)
export const uploadDocumentForRequest = async (
  requestId,
  file,
  currentUser,
) => {
  console.log("Uploading document for request:", {
    requestId,
    file: file ? { originalname: file.originalname, mimetype: file.mimetype } : null,
  });

  // Check if there is a file in the request
  if (!file) {
    throw new AppError(
      commonErrors.NO_FILE_UPLOADED.message,
      commonErrors.NO_FILE_UPLOADED.code,
      commonErrors.NO_FILE_UPLOADED.errorCode,
      commonErrors.NO_FILE_UPLOADED.suggestion,
    );
  }

  // Check the document request existence
  const request = await DocumentRequest.findById(requestId);
  if (!request) {
    throw new AppError(
      errors.DOCUMENT_REQUEST_NOT_FOUND.message,
      errors.DOCUMENT_REQUEST_NOT_FOUND.code,
      errors.DOCUMENT_REQUEST_NOT_FOUND.errorCode,
      errors.DOCUMENT_REQUEST_NOT_FOUND.suggestion,
    );
  }

  // Prevent the document upload if fulfilled
  if (request.status === "Fulfilled") {
    throw new AppError(
      errors.DOCUMENT_REQUEST_FULLFILLED.message,
      errors.DOCUMENT_REQUEST_FULLFILLED.code,
      errors.DOCUMENT_REQUEST_FULLFILLED.errorCode,
      errors.DOCUMENT_REQUEST_FULLFILLED.suggestion,
    );
  }

  // Authorization check: only the project team members can upload documents to fulfill the document request
  const project = await Project.findById(request.projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Check the team existence for the project
  const team = await Team.findOne({ projectId: request.projectId });
  if (!team) {
    throw new AppError(
      projectErrors.TEAM_NOT_FOUND.message,
      projectErrors.TEAM_NOT_FOUND.code,
      projectErrors.TEAM_NOT_FOUND.errorCode,
      projectErrors.TEAM_NOT_FOUND.suggestion,
    );
  }

  const isMember = await TeamMember.exists({
    teamId: team._id,
    userId: currentUser.id,
  });

  const isProductOwner = project.productOwnerId.toString() === currentUser.id;

  if (!isMember && !isProductOwner) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_FULFILL_DOCUMENT_REQUEST.message,
      errors.UNAUTHORIZED_TO_FULFILL_DOCUMENT_REQUEST.code,
      errors.UNAUTHORIZED_TO_FULFILL_DOCUMENT_REQUEST.errorCode,
      errors.UNAUTHORIZED_TO_FULFILL_DOCUMENT_REQUEST.suggestion,
    );
  }

  // Upload the file to Cloudinary
  const cloudResult = await uploadDocumentCore(
    file,
    "hrcom/project_docs/images",
    "hrcom/project_docs/docs",
  );

  // Update the document request status to "Under Review" and set the uploadedBy field
  request.fileURL = cloudResult.fileURL;
  request.fileName = file.originalname;
  request.public_id = cloudResult.filePublicId;
  request.status = "Under Review";
  await request.save();

  // Get the user who uploaded the document
  const user = await User.findById(currentUser.id);

  // Notfiy the document request creator that a document has been uploaded to fulfill their request
  try {
    await createNotification({
      recipientId: request.requestedBy.toString(),
      type: "DOCUMENT_REQUEST",
      title: "Document Uploaded for Your Document Request",
      message: `A document has been uploaded by ${user.name} ${user.lastName} to fullfill your document request "${request.title}".`,
      data: {
        entityType: "DocumentRequest",
        entityId: request._id,
      },
    });
  } catch (error) {
    console.error(
      "Failed to send notification for document request doc upload:",
      error,
    );
  }

  return {
    status: "Success",
    code: 201,
    message: "Document uploaded to the document request successfully!",
    data: request,
  };
};

// Consult a document related to the document request
export const consultDocumentForRequest = async (documentId, currentUser) => {
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

  // Check if the document is related to a project
  if (!document.projectId) {
    throw new AppError(
      documentErrors.NOT_A_PROJECT_DOCUMENT.message,
      documentErrors.NOT_A_PROJECT_DOCUMENT.code,
      documentErrors.NOT_A_PROJECT_DOCUMENT.errorCode,
      documentErrors.NOT_A_PROJECT_DOCUMENT.suggestion,
    );
  }

  // Admin can see all project documents
  if (currentUser.role === "Admin") {
    return consultDocumentCore(document);
  }

  // Get the project document
  const project = await Project.findById(document.projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Authorization check: only the project team members can consult the document
  // Check Product Owner
  const isOwner = project.productOwnerId.toString() === currentUser.id;

  // Check team membership
  const team = await Team.findOne({ projectId: project._id });

  let isMember = false;
  if (team) {
    isMember = await TeamMember.exists({
      teamId: team._id,
      userId: currentUser.id,
    });
  }

  if (!isOwner && !isMember) {
    throw new AppError(
      documentErrors.UNAUTHORIZED_ACCESS.message,
      documentErrors.UNAUTHORIZED_ACCESS.code,
      documentErrors.UNAUTHORIZED_ACCESS.errorCode,
      documentErrors.UNAUTHORIZED_ACCESS.suggestion,
    );
  }

  return consultDocumentCore(document);
};

// Download a document related to the document request
export const downloadDocumentForRequest = async (
  documentId,
  res,
  currentUser,
) => {
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

  // Check if the document is related to a project
  if (!document.projectId) {
    throw new AppError(
      documentErrors.NOT_A_PROJECT_DOCUMENT.message,
      documentErrors.NOT_A_PROJECT_DOCUMENT.code,
      documentErrors.NOT_A_PROJECT_DOCUMENT.errorCode,
      documentErrors.NOT_A_PROJECT_DOCUMENT.suggestion,
    );
  }

  // Admin can see all project documents
  if (currentUser.role === "Admin") {
    return await downloadDocumentCore(document, res);
  }

  // Get the project document
  const project = await Project.findById(document.projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Authorization check: only the project team members can consult the document
  // Check Product Owner
  const isOwner = project.productOwnerId.toString() === currentUser.id;

  // Check team membership
  const team = await Team.findOne({ projectId: project._id });

  let isMember = false;
  if (team) {
    isMember = await TeamMember.exists({
      teamId: team._id,
      userId: currentUser.id,
    });
  }

  if (!isOwner && !isMember) {
    throw new AppError(
      documentErrors.UNAUTHORIZED_ACCESS.message,
      documentErrors.UNAUTHORIZED_ACCESS.code,
      documentErrors.UNAUTHORIZED_ACCESS.errorCode,
      documentErrors.UNAUTHORIZED_ACCESS.suggestion,
    );
  }

  return await downloadDocumentCore(document, res);
};

// Delete a document related to the document request
export const deleteDocumentForRequest = async (documentId, currentUser) => {
  const document = await Document.findById(documentId);
  if (!document)
    throw new AppError(
      commonErrors.DOCUMENT_NOT_FOUND.message,
      commonErrors.DOCUMENT_NOT_FOUND.code,
      commonErrors.DOCUMENT_NOT_FOUND.errorCode,
      commonErrors.DOCUMENT_NOT_FOUND.suggestion,
    );

  // Only the uploader can delete the document
  if (document.uploadedBy.toString() !== currentUser.id) {
    throw new AppError(
      documentErrors.UNAUTHORIZED_TO_DELETE_DOCUMENT.message,
      documentErrors.UNAUTHORIZED_TO_DELETE_DOCUMENT.code,
      documentErrors.UNAUTHORIZED_TO_DELETE_DOCUMENT.errorCode,
      documentErrors.UNAUTHORIZED_TO_DELETE_DOCUMENT.suggestion,
    );
  }

  await deleteDocumentCore(document);

  // Get the user that uploaded the document
  const user = await User.findById(currentUser.id);

  // Get the document request related to the document
  const request = await DocumentRequest.findById(document.documentRequestId);
  if (!request) {
    throw new AppError(
      errors.DOCUMENT_REQUEST_NOT_FOUND.message,
      errors.DOCUMENT_REQUEST_NOT_FOUND.code,
      errors.DOCUMENT_REQUEST_NOT_FOUND.errorCode,
      errors.DOCUMENT_REQUEST_NOT_FOUND.suggestion,
    );
  }

  // Notify the document request creator that a document has been deleted from their request
  try {
    await createNotification({
      recipientId: request.requestedBy.toString(),
      type: "DOCUMENT_REQUEST",
      title: "Document Deleted for Your Document Request",
      message: `${user.name} ${user.lastName} deleted the document that ${user.gender === "Male" ? "he" : "she"} uploaded from your document request "${request.title}".`,
      data: {
        entityType: "DocumentRequest",
        entityId: request._id,
      },
    });
  } catch (error) {
    console.error(
      "Failed to send notification for document request document deletion:",
      error,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Document deleted successfully",
  };
};

// Get all documents related to a document request
export const getDocumentsByRequest = async (
  requestId,
  currentUser,
  queryParams,
) => {
  // Check request existence
  const request = await DocumentRequest.findById(requestId);
  if (!request) {
    throw new AppError(
      documentRequestErrors.DOCUMENT_REQUEST_NOT_FOUND.message,
      documentRequestErrors.DOCUMENT_REQUEST_NOT_FOUND.code,
      documentRequestErrors.DOCUMENT_REQUEST_NOT_FOUND.errorCode,
      documentRequestErrors.DOCUMENT_REQUEST_NOT_FOUND.suggestion,
    );
  }

  const finalQuery = {
    ...queryParams,
    documentRequestId: requestId,
    sort: "-createdAt",
  };

  return await getAll(
    Document,
    [{ path: "uploadedBy", select: "name email" }],
    "-filePublicId -__v",
    ["title"],
  )(finalQuery);
};
