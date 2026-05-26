import * as employeeAllowanceService from "../services/employeeAllowanceService.js";

// Assign an allowance to an employee
export const assignAllowanceToEmployee = async (req, res, next) => {
  try {
    const result = await employeeAllowanceService.assignAllowanceToEmployee(
      req.body,
      req.ip,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Toggle the active status of an employee allowance
export const toggleEmployeeAllowanceActivation = async (req, res, next) => {
  try {
    const result =
      await employeeAllowanceService.toggleEmployeeAllowanceActivation(
        req.params.id,
        req.ip,
        req.user,
      );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all employee allowances
export const getAllEmployeeAllowances = async (req, res, next) => {
  try {
    const result = await employeeAllowanceService.getAllEmployeeAllowances(
      req.query,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Update an employee's allowance
export const updateEmployeeAllowance = async (req, res, next) => {
  try {
    const result = await employeeAllowanceService.updateEmployeeAllowance(
      req.params.id,
      req.body,
      req.ip,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get an employee allowance by ID
export const getEmployeeAllowanceById = async (req, res, next) => {
  try {
    const result = await employeeAllowanceService.getEmployeeAllowanceById(
      req.params.id,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get an employee allowances
export const getEmployeeAllowances = async (req, res, next) => {
  try {
    const result = await employeeAllowanceService.getEmployeeAllowances(
      req.params.id,
      req.user,
      req.query,
    );
    
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
