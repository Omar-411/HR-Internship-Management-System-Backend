import mongoose from "mongoose";
import * as sprintService from "../services/sprintService.js";
import { errors as projectErrors } from "../errors/projectErrors.js";
import AppError from "../utils/AppError.js";

// Get all sprints of a project
export const getProjectSprints = async (req, res, next) => {
  try {
    // Build the query parameters
    const { projectId } = req.params;

    const queryParams = {
      ...req.query,
      limit: 6,
      projectId,
      user: req.user,
    };

    const result = await sprintService.getAllSprintsOfProject(queryParams);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get a sprint by Id
export const getSprintById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid sprint ID' });
    }
    const sprintId = new mongoose.Types.ObjectId(id);

    const result = await sprintService.getSprintById(sprintId, req.user);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Create a new sprint
export const createSprint = async (req, res, next) => {
  try {
    const result = await sprintService.createSprint(req);
    res.status(result.code).json(result);
  }
  catch (err) {
    next(err);
  }
};

// Update a sprint
export const updateSprint = async (req, res, next) => {
  try {
    const { sprintId: sid } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sid)) {
      return res.status(400).json({ message: 'Invalid sprint ID' });
    }
    const sprintId = new mongoose.Types.ObjectId(sid);

    const result = await sprintService.updateSprint(
      sprintId,
      req.body,
      req.user
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Delete a sprint
export const deleteSprint = async (req, res, next) => {
  try {
    const { sprintId: sid } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sid)) {
      return res.status(400).json({ message: 'Invalid sprint ID' });
    }
    const sprintId = new mongoose.Types.ObjectId(sid);

    const result = await sprintService.deleteSprint(sprintId, req.user);
    res.status(result.code).json(result);
  }
  catch (err) {
    next(err);
  }
};

// Start a sprint
export const startSprint = async (req, res, next) => {
  try {
    const { sprintId: sid } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sid)) {
      return res.status(400).json({ message: 'Invalid sprint ID' });
    }
    const sprintId = new mongoose.Types.ObjectId(sid);

    const result = await sprintService.startSprint(sprintId, req.user);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }  
};

// Complete a sprint
export const completeSprint = async (req, res, next) => {
  try {
    const { sprintId: sid } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sid)) {
      return res.status(400).json({ message: 'Invalid sprint ID' });
    }
    const sprintId = new mongoose.Types.ObjectId(sid);

    const result = await sprintService.completeSprint(sprintId, req.user);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
