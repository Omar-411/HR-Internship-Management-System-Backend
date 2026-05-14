import express from "express";
import { 
  getSupervisorDashboard, 
  getAdminDashboard, 
  getProjectCharts,
  getDashboardStats
} from "../controllers/dashboardController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

/**
 * Route to get Supervisor Dashboard data
 */
router.get("/dashboard/supervisor", authenticate, authorize(["Supervisor"]), getSupervisorDashboard);

/**
 * Route to get Admin Dashboard data
 */
router.get("/dashboard/admin", authenticate, authorize(["Admin"]), getAdminDashboard);

/**
 * Route to fetch project charts (Task breakdown, Velocity)
 * accessible by project members (Admin, Supervisor, Employee, Intern)
 */
router.get("/dashboard/project/:id/charts", authenticate, authorize(["Admin", "Supervisor", "Employee", "Intern"]), getProjectCharts);

/**
 * Route to get stats for Employee/Intern dashboards
 */
router.get("/dashboard/stats", authenticate, getDashboardStats);

export default router;
