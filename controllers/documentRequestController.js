import * as documentRequestService from "../services/documentRequestService.js";
import * as projectDocumentService from "../services/projectDocumentService.js";
import DocumentRequest from "../models/DocumentRequest.js";

// Create a new document request
export const createDocumentRequest = async (req, res, next) => {
  try {
    const result = await documentRequestService.createDocumentRequest(
      req.body,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all document requests for a project
export const getAllDocumentRequests = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const result = await documentRequestService.getAllDocumentRequests(
      projectId,
      req.query,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get a document request by ID
export const getDocumentRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await documentRequestService.getDocumentRequestById(
      id,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Delete a document request
export const deleteDocumentRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await documentRequestService.deleteDocumentRequest(
      id,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Mark a document request as fulfilled
export const markDocumentRequestAsFulfilled = async (req, res, next) => {
  try {
    const { id } = req.params; // ID of the document request to mark as fulfilled
    
    const result = await documentRequestService.markDocumentRequestAsFulfilled(
      id,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Reject a document request
export const rejectDocumentRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    const result = await documentRequestService.rejectDocumentRequest(
      id,
      comment,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Upload a document to fulfill a document request
export const uploadDocumentFulfillRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await projectDocumentService.uploadDocumentForRequest(
      id,
      req.file,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Consult a document related to the document request
export const consultDocumentFulfillRequest = async (req, res, next) => {
  try {
    const { id: documentRequestId } = req.params;

    const result = await projectDocumentService.consultDocumentForRequest(
      documentRequestId,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Download a document related to the document request
export const downloadDocumentFulfillRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    await projectDocumentService.downloadDocumentForRequest(id, req.user, res);

  } catch (err) {
    if (!res.headersSent) next(err);
  }
};
