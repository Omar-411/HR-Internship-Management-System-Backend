import express from "express";
import {
  generatePayrollForEmployee,
  getPayrollById,
  getAllPayrolls,
  getPayrollTrend,
  getPayrollByDepartment,
  getEmployeePayrolls,
  validatePayroll,
  markPayrollAsPaid,
  recomputePayroll,
  exportPayrollToExcel,
} from "../controllers/payrollController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Route to get the 6-month net payout trend (Admin only)
router.get(
  "/payrolls/trend",
  authenticate,
  authorize(["Admin"]),
  getPayrollTrend,
);

// Route to get net payout breakdown by department for a given month/year (Admin only)
router.get(
  "/payrolls/by-department",
  authenticate,
  authorize(["Admin"]),
  getPayrollByDepartment,
);

// Route to calculate payroll for an employee for a given month and year
router.post(
  "/payroll/calculate/:employeeId/:month/:year",
  authenticate,
  authorize(["Admin"]),
  generatePayrollForEmployee,
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
  upload("doc").single("paymentProof"),
  markPayrollAsPaid,
);

// Route to recompute a payroll (Admin only)
router.post(
  "/payroll/recompute/:payrollId",
  authenticate,
  authorize(["Admin"]),
  recomputePayroll,
);

// Route to export a payroll to Excel (Admin only)
router.get(
  "/payrolls/:id/export/excel",
  authenticate,
  authorize(["Admin"]),
  exportPayrollToExcel,
);

export default router;
