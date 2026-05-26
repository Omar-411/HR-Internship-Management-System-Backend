import * as projectService from "../services/projectService.js";
import * as projectAnalyticsService from "../services/analytics/projectAnalyticsService.js";
import * as projectAiEvaluationService from "../services/projectAiEvaluationService.js";

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

    const result = await projectAnalyticsService.getProjectOverview(
      param,
      normalizedParam,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Evaluate and rank project candidates with the AI matching model
export const evaluateProjectCandidates = async (req, res, next) => {
  try {
    const result =
      await projectAiEvaluationService.evaluateProjectCandidatesForBackend(
        req.params.id,
        {
          scope: req.query.scope,
          parseCvUrls: req.body?.parseCvUrls,
          cvTexts: req.body?.cvTexts,
          aiOptions: req.body?.aiOptions,
          currentUser: req.user,
        },
      );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get the stored AI evaluation state/result for a project
export const getProjectAiEvaluation = async (req, res, next) => {
  try {
    const result =
      await projectAiEvaluationService.getStoredProjectAiEvaluation(
        req.params.id,
        req.user,
      );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get a project details by ID
export const getProjectById = async (req, res, next) => {
  try {
    const param = req.params.id;
    const normalizedParam = param.trim().toLowerCase();

    const result = await projectService.getProjectById(
      param,
      normalizedParam,
      req.user,
    );

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

// Update a project (Supervisor only)
export const updateProject = async (req, res, next) => {
  try {
    const param = req.params.id;
    const normalizedParam = param.trim().toLowerCase();

    const result = await projectService.updateProject(
      param,
      normalizedParam,
      req.body,
      req.user.id,
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

    const result = await projectService.archiveProject(
      param,
      normalizedParam,
      req.user.id,
    );

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

    const result = await projectService.restoreProject(
      param,
      normalizedParam,
      req.user.id,
    );

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

    const result = await projectService.deleteProject(
      param,
      normalizedParam,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
