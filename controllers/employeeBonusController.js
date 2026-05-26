import * as employeeBonusService from "../services/employeeBonusService.js";

// Assign a bonus to an employee
export const assignBonusToEmployee = async (req, res, next) => {
  try {
    const result = await employeeBonusService.assignBonusToEmployee(
      req.body,
      req.ip,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Toggle the active status of an employee bonus
export const toggleEmployeeBonusActivation = async (req, res, next) => {
  try {
    const result =
      await employeeBonusService.toggleEmployeeBonusActivation(
        req.params.id,
        req.ip,
        req.user,
      );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all employee bonuses
export const getAllEmployeeBonuses = async (req, res, next) => {
  try {
    const result = await employeeBonusService.getAllEmployeeBonuses(
      req.query,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Update an employee's bonus
export const updateEmployeeBonus = async (req, res, next) => {
  try {
    const result = await employeeBonusService.updateEmployeeBonus(
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

// Get an employee bonus by ID
export const getEmployeeBonusById = async (req, res, next) => {
  try {
    const result = await employeeBonusService.getEmployeeBonusById(
      req.params.id,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get an employee bonuses
export const getEmployeeBonuses = async (req, res, next) => {
  try {
    const result = await employeeBonusService.getEmployeeBonuses(
      req.params.id,
      req.user,
      req.query,
    );
    
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
