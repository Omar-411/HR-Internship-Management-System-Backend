import express from "express";
import {
  calculatePayroll,
  getPayrollById,
  getAllPayrolls,
  getEmployeePayrolls,
  validatePayroll,
  markPayrollAsPaid,
  recomputePayroll,
  getPayrollKPIs,
} from "../controllers/payrollController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Route to get payroll KPIs for the current month and year
router.get(
  "/payroll/kpis",
  authenticate,
  authorize(["Admin"]),
  getPayrollKPIs,
);

// Route to calculate payroll for an employee for a given month and year
router.post(
  "/payroll/calculate/:employeeId/:month/:year",
  authenticate,
  authorize(["Admin"]),
  calculatePayroll,
);

// Route to get a payroll record by ID
router.get("/payroll/:id", authenticate, getPayrollById);

// Route to get all payroll records
router.get("/payrolls", authenticate, authorize(["Admin"]), getAllPayrolls);

// Route to get an employee's payroll history
router.get("/payrolls/employee", authenticate, getEmployeePayrolls);

// Route to validate a payroll (Admin only)
router.patch(
  "/payroll/:id/validate",
  authenticate,
  authorize(["Admin"]),
  validatePayroll,
);

// Route to mark a payroll as paid (Admin only)
router.patch(
  "/payroll/:id/paid",
  authenticate,
  authorize(["Admin"]),
  markPayrollAsPaid,
);

// Route to recompute a payroll (Admin only)
router.post(
  "/payroll/recompute/:payrollId",
  authenticate,
  authorize(["Admin"]),
  recomputePayroll,
);

export default router;
