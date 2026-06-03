import * as bonusTypeService from "../services/bonusTypeService.js";

// Create a new bonus type
export const createBonusType = async (req, res, next) => {
  try {
    const result = await bonusTypeService.createBonusType(
      req.body,
      req.user,
      req.ip,
    );
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Toggle the bonus type activation status
export const toggleBonusTypeActivation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await bonusTypeService.toggleBonusTypeActivation(
      id,
      req.user,
      req.ip,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all bonus types
export const getAllBonusTypes = async (req, res, next) => {
  try {
    const result = await bonusTypeService.getAllBonusTypes(req.query);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get a bonus type by ID
export const getBonusTypeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await bonusTypeService.getBonusTypeById(id);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Update a bonus type
export const updateBonusType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, name, isTaxable, defaultAmount } = req.body;

    const result = await bonusTypeService.updateBonusType(
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
