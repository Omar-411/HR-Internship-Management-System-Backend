import express from "express";
import {
  createPayrollConfig,
  getActivePayrollConfig,
  getAllConfigs,
  createNewVersion,
  getYearVersions,
  toggleActivation,
} from "../controllers/payrollConfigController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Create a new payroll configuration for a specific year
router.post(
  "/payroll-config",
  authenticate,
  authorize(["Admin"]),
  createPayrollConfig,
);

// Get the active payroll configuration for a specific year
router.get(
  "/payroll-config/active/:year",
  authenticate,
  authorize(["Admin"]),
  getActivePayrollConfig,
);

// Get all payroll configurations
router.get(
  "/payroll-configs",
  authenticate,
  authorize(["Admin"]),
  getAllConfigs,
);

// Create a new version of the payroll configuration for a specific year
router.post(
  "/payroll-config/new-version",
  authenticate,
  authorize(["Admin"]),
  createNewVersion,
);

// Get all versions for a specific year
router.get(
  "/payroll-config/:year/versions",
  authenticate,
  authorize(["Admin"]),
  getYearVersions,
);

// Toggle the activation status of a payroll configuration for a specific year
router.patch(
  "/payroll-config/toggle-activation/:id",
  authenticate,
  authorize(["Admin"]),
  toggleActivation,
);

export default router;
