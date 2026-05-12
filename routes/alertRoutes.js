import express from "express";
import {
  createAlert,
  getMyAlerts,
  getAlertById,
  updateAlert,
  deleteAlert,
} from "../services/alertService.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Create a new alert
router.post(
  "/alerts",
  authenticate,
  authorize(["Intern", "Supervisor", "Employee"]),
  upload("doc").single("attachment"),
  createAlert,
);

// Get all alerts for the current user
router.get("/alerts/me", authenticate, getMyAlerts);

// Get an alert by Id
router.get("/alerts/:id", authenticate, getAlertById);

// Update an alert
router.patch(
  "/alerts/:id",
  authenticate,
  upload("doc").single("attachment"),
  updateAlert,
);
  
// Delete an alert
router.delete(
  "/alerts/:id",
  authenticate,
  deleteAlert,
);

export default router;
