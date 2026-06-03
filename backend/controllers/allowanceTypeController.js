import * as allowanceTypeService from "../services/allowanceTypeService.js";

// Create a new allowance type
export const createAllowanceType = async (req, res, next) => {
  try {
    const result = await allowanceTypeService.createAllowanceType(
      req.body,
      req.ip,
      req.user,
    );
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Toggle the allowance type activation status
export const toggleAllowanceTypeActivation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await allowanceTypeService.toggleAllowanceTypeActivation(
      id,
      req.user,
      req.ip,
    );
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all allowance types
export const getAllAllowanceTypes = async (req, res, next) => {
  try {
    const result = await allowanceTypeService.getAllAllowanceTypes(req.query);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get an allowance type by ID
export const getAllowanceTypeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await allowanceTypeService.getAllowanceTypeById(id);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Update an allowance type
export const updateAllowanceType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, name, isTaxable, defaultAmount } = req.body;

    const result = await allowanceTypeService.updateAllowanceType(
      id,
      {
        code,
        name,
        isTaxable,
        defaultAmount,
      },
      req.user,
      req.ip,
    );
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
