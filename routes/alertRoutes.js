import express from "express";
import {
  createAlert,
  getMyAlerts,
  getAlertById,
  updateAlert,
  deleteAlert,
  getAlerts,
  markAlertUnderReview,
  resolveAlert,
  dismissAlert,
  getAlertKPIs,
} from "../controllers/alertController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Route to get admin alert KPIs
router.get(
  "/alerts/kpis",
  authenticate,
  authorize(["Admin"]),
  getAlertKPIs,
);

// Route to create a new alert
router.post(
  "/alerts",
  authenticate,
  authorize(["Intern", "Supervisor", "Employee"]),
  upload("doc").single("attachment"),
  createAlert,
);

// Route to get all alerts for the current user
router.get("/alerts/me", authenticate, getMyAlerts);

// Route to get an alert by Id
router.get("/alert/:id", authenticate, getAlertById);

// Route to update an alert
router.patch(
  "/alerts/:id",
  authenticate,
  upload("doc").single("attachment"),
  updateAlert,
);

// Route to delete an alert
router.delete("/alerts/:id", authenticate, deleteAlert);

// Route to get all alerts (for supervisors and Admins)
router.get(
  "/alerts",
  authenticate,
  authorize(["Supervisor", "Admin"]),
  getAlerts,
);

// Route to mark an alert as UNDER_REVIEW (for supervisors and Admins)
router.patch(
  "/alerts/:id/under-review",
  authenticate,
  authorize(["Supervisor", "Admin"]),
  markAlertUnderReview,
);
  
// Route to resolve an alert (for supervisors and Admins)
router.patch(
  "/alerts/:id/resolve",
  authenticate,
  authorize(["Supervisor", "Admin"]),
  resolveAlert,
);

// Route to dismiss an alert (for supervisors and Admins)
router.patch(
  "/alerts/:id/dismiss",
  authenticate,
  authorize(["Supervisor", "Admin"]),
  dismissAlert,
);
  
export default router;
