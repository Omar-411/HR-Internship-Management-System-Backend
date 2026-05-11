import * as payrollService from "../services/payrollService.js";
import * as payrollStatsService from "../services/analytics/payrollStatsService.js";

// Calculate payroll for an employee for a given month and year
export const calculatePayroll = async (req, res, next) => {
  try {
    const { employeeId, month, year } = req.params;

    const result = await payrollService.calculatePayroll(
      employeeId,
      parseInt(month),
      parseInt(year),
    );

    res.status(result.code).json(result);
  } catch (error) {
    next(error);
  }
};

// Get a payroll record by ID
export const getPayrollById = async (req, res, next) => {
  try {
    const result = await payrollService.getPayrollById(req.params.id, req.user);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all payroll records
export const getAllPayrolls = async (req, res, next) => {
  try {
    const result = await payrollService.getAllPayrolls(req.query);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get an employee's payroll history
export const getEmployeePayrolls = async (req, res, next) => {
  try {
    const result = await payrollService.getEmployeePayrolls(
      req.user,
      req.query,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Validate a payroll (Admin only)
export const validatePayroll = async (req, res, next) => {
  try {
    const result = await payrollService.validatePayroll(
      req.params.id,
      req.user,
      req.ip,
    );
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Mark a payroll as paid (Admin only)
export const markPayrollAsPaid = async (req, res, next) => {
  try {
    const result = await payrollService.markPayrollAsPaid(
      req.params.id,
      req.user,
      req.ip,
    );
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Recompute a payroll (Admin only)
export const recomputePayroll = async (req, res, next) => {
  try {
    const { payrollId } = req.params;
    const user = req.user;

    const result = await payrollService.recomputePayroll(
      payrollId,
      user,
      req.ip,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get payroll KPIs for the current month and year
export const getPayrollKPIs = async (req, res, next) => {
  try {
    const result = await payrollStatsService.getPayrollKPIs();
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
