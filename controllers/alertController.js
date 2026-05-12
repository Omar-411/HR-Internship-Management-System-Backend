import * as alertService from "../services/alertService.js";

// Create a new alert
export const createAlert = async (req, res, next) => {
  try {
    const result = await alertService.createAlert(req.body, req.user, req.file);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all alerts
export const getMyAlerts = async (req, res, next) => {
  try {
    const result = await alertService.getMyAlerts(req.query, req.user.id);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get an alert by Id
export const getAlertById = async (req, res, next) => {
  try {
    const result = await alertService.getAlertById(req.params.id, req.user);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Update an alert
export const updateAlert = async (req, res, next) => {
  try {
    const result = await alertService.updateAlert(
      req.params.id,
      req.body,
      req.user,
      req.file
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Delete an alert
export const deleteAlert = async (req, res, next) => {
  try {
    const result = await alertService.deleteAlert(
      req.params.id,
      req.user
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
