import express from "express";
import {
  getResignationById,
  getMyResignation,
  getAllResignations,
  getResignationStatuses,
  submitResignation,
  updateResignation,
  getResignationKPIs,
  requestClarification,
  respondToClarification,
  approveResignation,
  startExitProcess,
} from "../controllers/resignationController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Get resignation statuses (For the frontend)
router.get("/resignation-statuses", authenticate, getResignationStatuses);

// Get resignation KPIs for the admin dashboard in the Resignation section
router.get(
  "/resignations/kpi",
  authenticate,
  authorize(["Admin"]),
  getResignationKPIs,
);

// Get the current user's own resignation request
router.get(
  "/resignations/my",
  authenticate,
  getMyResignation,
);

// Get a single resignation request by ID
router.get("/resignations/:id", authenticate, getResignationById);

// Get all resignation requests (Admin only)
router.get(
  "/resignations",
  authenticate,
  authorize(["Admin"]),
  getAllResignations,
);

// Submit a resignation request (Employees only: No Interns allowed)
router.post(
  "/resignations",
  authenticate,
  authorize(["Employee", "Supervisor"]),
  submitResignation,
);

// Update a resignation request (The employee that submitted the resignation request only)
router.patch(
  "/resignations/:id", 
  authenticate, 
  updateResignation
);

// Request clarification on a resignation request (Admin only)
router.patch(
  "/resignations/:id/request-clarification",
  authenticate,
  authorize(["Admin"]),
  requestClarification,
);

// Respond to a clarification request
router.patch(
  "/resignations/:id/respond-clarification",
  authenticate,
  authorize(["Employee"]),
  respondToClarification,
);

// Approve a resignation request (Admin only)
router.patch(
  "/resignations/:id/approve",
  authenticate,
  authorize(["Admin"]),
  approveResignation,
);

// Start the exit process (Admin only)
router.patch(
  "/resignations/:id/start-exit",
  authenticate,
  authorize(["Admin"]),
  startExitProcess,
);

export default router;
