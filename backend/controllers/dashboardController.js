import Project from "../models/Project.js";
import Task from "../models/Task.js";
import * as dashboardService from "../services/dashboardService.js";
import { resolveId } from "../utils/idResolver.js";
import { isTeamMemberOrProductOwnerOrAdmin } from "../utils/projectHelpers.js";

// Supervisor Dashboard
export const getSupervisorDashboard = async (req, res, next) => {
  try {
    const result = await dashboardService.getSupervisorDashboard(req.user);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Admin Dashboard
export const getAdminDashboard = async (req, res, next) => {
  try {
    const result = await dashboardService.getAdminDashboard(req.user);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Employee/Intern Stats
export const getDashboardStats = async (req, res, next) => {
  try {
    const result = await dashboardService.getDashboardStats(req.user);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
