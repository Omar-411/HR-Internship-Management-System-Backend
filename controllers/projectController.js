import Project from "../models/Project.js";
import * as projectService from "../services/projectService.js";
import * as projectAnalyticsService from "../services/analytics/projectAnalyticsService.js";

// Get all the sectors in a project
export const getAllSectors = async (req, res, next) => {
  try {
    const result = await projectService.getAllSectors();

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all the statuses in a project (except "Archived" because it's in a different section in the frontend)
export const getAllStatuses = async (req, res, next) => {
  try {
    const result = await projectService.getAllStatuses();

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all projects (12 projects per page)
export const getAllProjects = async (req, res, next) => {
  try {
    const result = await projectService.getAllProjects(req);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get project overview (Stats about sprints, tasks, velocity, etc.)
export const getProjectOverview = async (req, res, next) => {
  try {
    const param = req.params.id;
    const normalizedParam = param.trim().toLowerCase();
    const project = await Project.findOne({
      $or: [
        { slug: normalizedParam },
        { publicId: param },
        ...(param.match(/^[a-f\d]{24}$/i) ? [{ _id: param }] : [])
      ]
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const result = await projectAnalyticsService.getProjectOverview(project._id, req.user);
    res.status(result.code).json(result);
  }
  catch (err) {
    next(err);
  }
};

// Get a project details by ID
export const getProjectById = async (req, res, next) => {
  try {
    const param = req.params.id;
    const normalizedParam = param.trim().toLowerCase();
    const project = await Project.findOne({
      $or: [
        { slug: normalizedParam },
        { publicId: param },
        ...(param.match(/^[a-f\d]{24}$/i) ? [{ _id: param }] : [])
      ]
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const result = await projectService.getProjectById(project._id, req.user);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Add a new project (Supervisor only)
export const createProject = async (req, res, next) => {
  try {
    const result = await projectService.createProject(req.body, req.user);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Update a project (Supervisor only): No team management here, just project details update
export const updateProject = async (req, res, next) => {
  try {
    const param = req.params.id;
    const normalizedParam = param.trim().toLowerCase();
    const project = await Project.findOne({
      $or: [
        { slug: normalizedParam },
        { publicId: param },
        ...(param.match(/^[a-f\d]{24}$/i) ? [{ _id: param }] : [])
      ]
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const result = await projectService.updateProject(
      project._id,
      req.body,
      req.user.id
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Archive a project (Supervisor Only)
export const archiveProject = async (req, res, next) => {
  try {
    const param = req.params.id;
    const normalizedParam = param.trim().toLowerCase();
    const project = await Project.findOne({
      $or: [
        { slug: normalizedParam },
        { publicId: param },
        ...(param.match(/^[a-f\d]{24}$/i) ? [{ _id: param }] : [])
      ]
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const result = await projectService.archiveProject(project._id, req.user.id);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Restore a Project (Supervisor Only)
export const restoreProject = async (req, res, next) => {
  try {
    const param = req.params.id;
    const normalizedParam = param.trim().toLowerCase();
    const project = await Project.findOne({
      $or: [
        { slug: normalizedParam },
        { publicId: param },
        ...(param.match(/^[a-f\d]{24}$/i) ? [{ _id: param }] : [])
      ]
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const result = await projectService.restoreProject(project._id, req.user.id);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Delete a project (Admin only)
export const deleteProject = async (req, res, next) => {
  try {
    const param = req.params.id;
    const normalizedParam = param.trim().toLowerCase();
    const project = await Project.findOne({
      $or: [
        { slug: normalizedParam },
        { publicId: param },
        ...(param.match(/^[a-f\d]{24}$/i) ? [{ _id: param }] : [])
      ]
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const result = await projectService.deleteProject(project._id, req.user);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
