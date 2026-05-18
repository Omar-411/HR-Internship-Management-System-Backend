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
import crypto from "crypto";
import AppError from "../utils/AppError.js";
import {
  uploadDocumentCore,
  downloadDocumentCore,
  deleteDocumentCore,
  consultDocumentCore,
} from "./documentCoreService.js";
import { getAll } from "./handlersFactory.js";

// Upload a document to fulfill a document request (Every member of the project team)
export const uploadDocumentForRequest = async (
  requestId,
  file,
  currentUser,
) => {
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
  if(!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  const team = await Team.findOne({ projectId: request.projectId });
  if(!team) {
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

  const isProductOwner = project.productOwnerId.toString() === currentUser.id;;

  if (!isMember && !isProductOwner) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_FULFILL_DOCUMENT_REQUEST.message,
      errors.UNAUTHORIZED_TO_FULFILL_DOCUMENT_REQUEST.code,
      errors.UNAUTHORIZED_TO_FULFILL_DOCUMENT_REQUEST.errorCode,
      errors.UNAUTHORIZED_TO_FULFILL_DOCUMENT_REQUEST.suggestion,
    );
  }

  // Prevent the requester from fulfilling their own request
  if (request.requestedBy.toString() === currentUser.id.toString()) {
    throw new AppError(
      errors.REQUESTER_CANNOT_FULFILL_OWN_REQUEST.message,
      errors.REQUESTER_CANNOT_FULFILL_OWN_REQUEST.code,
      errors.REQUESTER_CANNOT_FULFILL_OWN_REQUEST.errorCode,
      errors.REQUESTER_CANNOT_FULFILL_OWN_REQUEST.suggestion,
    );
  }

  // Generate a file hash
  const fileHash = crypto
    .createHash("sha256")
    .update(file.buffer)
    .digest("hex");

  // Check for duplicate file using the hash
  const existingDoc = await Document.findOne({ fileHash });
  if (existingDoc) {
    throw new AppError(
      documentErrors.DUPLICATE_FILE.message,
      documentErrors.DUPLICATE_FILE.code,
      documentErrors.DUPLICATE_FILE.errorCode,
      documentErrors.DUPLICATE_FILE.suggestion
    );
  }

  // Upload the file to Cloudinary
  const cloudResult = await uploadDocumentCore(
    file,
    "hrcom/project_docs/images",
    "hrcom/project_docs/docs",
  );

  // The project documents are assumed reports
  const documentType = await DocumentType.findOne({ name: "Report" });
  if (!documentType) {
    throw new AppError(
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.message,
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.code,
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.errorCode,
      documentTypeErrors.DOCUMENT_TYPE_NOT_FOUND.suggestion,
    );
  }

  // Create a new document
  const document = await Document.create({
    title: file.originalname || request.title,
    ...cloudResult,
    fileHash: fileHash,
    documentType_id: documentType._id,
    projectId: request.projectId,
    uploadedBy: currentUser.id,
    documentRequestId: requestId,
  });

  // Update the parent DocumentRequest status to "in_review" and save the file details
  request.status = "in_review";
  request.fileURL = cloudResult.fileURL;
  request.fileName = file.originalname || request.title;
  request.public_id = cloudResult.filePublicId;
  await request.save();

  // Populate for real-time frontend display
  await request.populate([
    { path: "requestedBy", select: "name email" },
    { path: "fulfilledBy", select: "name email" },
    { path: "sprintId", select: "name" },
    { path: "taskId", select: "title" }
  ]);

  // Emit socket event for real-time update
  try {
    const { getIO } = await import("../socket.js");
    const io = getIO();
    if (io) {
      const projectRoom = `project:${request.projectId}`;
      io.to(projectRoom).emit("documentRequestUpdated", {
        projectId: String(request.projectId),
        document: request
      });
    }
  } catch (socketErr) {
    console.error("[Socket] Failed to emit documentRequestUpdated (Upload):", socketErr);
  }

  return {
    status: "Success",
    code: 201,
    message: "Document uploaded and request fulfilled successfully!",
    data: document,
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
  const isOwner =
    project.productOwnerId.toString() === currentUser.id;

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
export const downloadDocumentForRequest = async (documentId, res, currentUser) => {
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
    return await downloadDocumentCore(document , res);
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
  const isOwner =
    project.productOwnerId.toString() === currentUser.id;

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
  if (!document) throw new AppError(
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

  return {
    status: "Success",
    code: 200,
    message: "Document deleted successfully",
  };
};

// Get all documents related to a document request
export const getDocumentsByRequest = async (requestId, currentUser, queryParams) => {
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
    ["title"]
  )(finalQuery);
};
