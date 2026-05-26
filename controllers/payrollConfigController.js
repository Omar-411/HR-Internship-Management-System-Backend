import * as payrollConfigService from "../services/payrollConfigService.js";

// Create a new payroll configuration for a specific year
export const createPayrollConfig = async (req, res, next) => {
  try {
    const result = await payrollConfigService.createPayrollConfig(
      req.body,
      req.user,
      req.ip,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all payroll configurations
export const getAllConfigs = async (req, res, next) => {
  try {
    const queryParams = req.query;
    const result = await payrollConfigService.getAllConfigs(queryParams);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get the active payroll configuration for a specific year
export const getActivePayrollConfig = async (req, res, next) => {
  try {
    const { year } = req.params;
    const result = await payrollConfigService.getActivePayrollConfig(year);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all versions for a specific year
export const getYearVersions = async (req, res, next) => {
  try {
    const { year } = req.params;
    const result = await payrollConfigService.getYearVersions(year);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Create a new version of the payroll configuration for a specific year
export const createNewVersion = async (req, res, next) => {
  try {
    const result = await payrollConfigService.createNewVersion(
      req.body,
      req.user,
      req.ip,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Toggle the activation status of a payroll configuration
export const toggleActivation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await payrollConfigService.togglePayrollConfigActivation(
      id,
      req.user,
      req.ip,
    );
    
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
