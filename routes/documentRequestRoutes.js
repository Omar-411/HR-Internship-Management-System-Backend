import express from "express";
import {
  createDocumentRequest,
  getAllDocumentRequests,
  getDocumentRequestById,
  deleteDocumentRequest,
  markDocumentRequestAsFulfilled,
  rejectDocumentRequest,
  uploadDocumentFulfillRequest,
  consultDocumentFulfillRequest,
  downloadDocumentFulfillRequest,
} from "../controllers/documentRequestController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Get all document requests for a project
router.get(
  "/document-requests/:projectId",
  authenticate,
  getAllDocumentRequests,
);

// Get a document request by ID
router.get("/document-request/:id", authenticate, getDocumentRequestById);

// Create a new document request
router.post("/document-requests", authenticate, createDocumentRequest);

// Delete a document request
router.delete("/document-requests/:id", authenticate, deleteDocumentRequest);

// Mark a document request as fulfilled
router.patch(
  "/document-requests/:id/fulfill",
  authenticate,
  markDocumentRequestAsFulfilled,
);

// Reject a document request
router.patch(
  "/document-requests/:id/reject",
  authenticate,
  rejectDocumentRequest,
);

// Upload a document to fulfill a document request
router.post(
  "/document-requests/:id/upload",
  authenticate,
  upload("doc").single("file"),
  uploadDocumentFulfillRequest,
);

// Consult a document to fullfill a document request
router.get(
  "/document-requests/:id/consult",
  authenticate,
  consultDocumentFulfillRequest,
);

// Download a document to fullfill a document request
router.get(
  "/document-requests/:id/download",
  authenticate,
  downloadDocumentFulfillRequest,
);

export default router;
