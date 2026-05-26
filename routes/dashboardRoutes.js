import express from "express";
import {
  getSupervisorDashboard,
  getAdminDashboard,
  getDashboardStats,
} from "../controllers/dashboardController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Route to get Supervisor Dashboard data
router.get(
  "/dashboard/supervisor",
  authenticate,
  authorize(["Supervisor"]),
  getSupervisorDashboard,
);

// Route to get Admin Dashboard data
router.get(
  "/dashboard/admin",
  authenticate,
  authorize(["Admin"]),
  getAdminDashboard,
);

// Route to get stats for Employee/Intern dashboards
router.get("/dashboard/stats", authenticate, getDashboardStats);

export default router;
