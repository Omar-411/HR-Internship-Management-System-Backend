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
  consultDocumentCore,
} from "./documentCoreService.js";
import { getAll } from "./handlersFactory.js";
import { createNotification } from "./notificationService.js";
import { isTeamMemberOrProductOwnerOrAdmin } from "../utils/projectHelpers.js";

// Upload a document to fulfill a document request (Every member of the project team)
export const uploadDocumentForRequest = async (
  requestId,
  file,
  currentUser,
) => {
  console.log("Uploading document for request:", {
    requestId,
    file: file
      ? { originalname: file.originalname, mimetype: file.mimetype }
      : null,
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
  request.uploadedBy = currentUser.id;
  request.uploadedAt = new Date();
  request.rejectionComment = null; // Clear any previous rejection comment if re-uploading after a rejection
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
export const consultDocumentForRequest = async (documentRequestId, currentUser) => {
  // Check the document existence
  const documentRequest = await DocumentRequest.findById(documentRequestId);
  if (!documentRequest) {
    throw new AppError(
      errors.DOCUMENT_REQUEST_NOT_FOUND.message,
      errors.DOCUMENT_REQUEST_NOT_FOUND.code,
      errors.DOCUMENT_REQUEST_NOT_FOUND.errorCode,
      errors.DOCUMENT_REQUEST_NOT_FOUND.suggestion,
    );
  }

  // Get the project document
  const project = await Project.findById(documentRequest.projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // AUTHORIZATION CHECK
  await isTeamMemberOrProductOwnerOrAdmin(
    project,
    currentUser,
    errors.UNAUTHORIZED_ACCESS
  );

  return consultDocumentCore(documentRequest);
};

// Download a document related to the document request
export const downloadDocumentForRequest = async (id, currentUser, res) => {
  // Check the document request existence
  const request = await DocumentRequest.findById(id);
  if (!request) {
    throw new AppError(
      errors.DOCUMENT_REQUEST_NOT_FOUND.message,
      errors.DOCUMENT_REQUEST_NOT_FOUND.code,
      errors.DOCUMENT_REQUEST_NOT_FOUND.errorCode,
      errors.DOCUMENT_REQUEST_NOT_FOUND.suggestion,
    );
  }

  // Get the project document
  const project = await Project.findById(request.projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // AUTHORIZATION CHECK
  await isTeamMemberOrProductOwnerOrAdmin(
    project,
    currentUser,
    errors.UNAUTHORIZED_ACCESS
  );

  // Check if there is an uploaded document to download
  if (!request.fileURL) {
    throw new AppError(
      "No file has been uploaded for this document request yet.",
      commonErrors.NO_FILE_UPLOADED.code,
      commonErrors.NO_FILE_UPLOADED.errorCode,
      commonErrors.NO_FILE_UPLOADED.suggestion,
    );
  }

  // Construct the Cloudinary download URL using fl_attachment
  const downloadURL = request.fileURL.replace(
    "/upload/",
    "/upload/fl_attachment/",
  );

  // Redirect the client to the Cloudinary download URL
  return res.redirect(302, downloadURL);
};
