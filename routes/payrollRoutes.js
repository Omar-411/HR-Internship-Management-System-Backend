import express from "express";
import {
  calculatePayroll,
  getPayrollById,
  getAllPayrolls,
  getPayrollTrend,
  getPayrollByDepartment,
  getEmployeePayrolls,
  validatePayroll,
  markPayrollAsPaid,
  recomputePayroll,
  bulkCalculatePayroll,
  getPayrollKPIs,
  exportPayrollToExcel,
} from "../controllers/payrollController.js";
import { exportPayslipToExcel } from "../services/payrollExportService.js";
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

// Route to get the 6-month net payout trend (Admin only)
router.get("/payrolls/trend", authenticate, authorize(["Admin"]), getPayrollTrend);

// Route to get net payout breakdown by department for a given month/year (Admin only)
router.get("/payrolls/by-department", authenticate, authorize(["Admin"]), getPayrollByDepartment);

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

// Route to export a payroll to Excel (Admin only)
router.get(
  "/payrolls/:id/export/excel",
  authenticate,
  authorize(["Admin"]),
  exportPayrollToExcel,
);

// Route to bulk calculate payroll for all eligible employees for a given month and year
router.post(
  "/payrolls/bulk-calculate/:month/:year",
  authenticate,
  authorize(["Admin"]),
  bulkCalculatePayroll,
);

// Route to export a payslip to Excel
router.get("/payrolls/export/excel", authenticate, async (req, res, next) => {
  try {
    const { employeeId, month, year, payrollId } = req.query;
    
    // We prioritize payrollId if provided (as from the frontend row.id)
    if (payrollId) {
      return await exportPayslipToExcel(payrollId, res);
    }

    if (!employeeId || !month) {
      return res.status(400).json({ message: "employeeId and month are required if payrollId is not provided" });
    }

    // If no payrollId, find by employee/month/year
    const Payroll = (await import("../models/Payroll.js")).default;
    const p = await Payroll.findOne({ 
      employeeId, 
      month: parseInt(month), 
      year: parseInt(year || new Date().getFullYear()) 
    });
    
    if (!p) {
      return res.status(404).json({ message: "No payslip found for this period" });
    }

    await exportPayslipToExcel(p._id, res);
  } catch (err) {
    next(err);
  }
});

export default router;
