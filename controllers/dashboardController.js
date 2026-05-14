import mongoose from "mongoose";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import * as dashboardService from "../services/dashboardService.js";

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

/**
 * Get project chart datasets (task completion by status + velocity by sprint)
 * derived from real tasks stored in the database.
 */
export const getProjectCharts = async (req, res) => {
  try {
    const { id: projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const project = await Project.findById(projectId).select("_id productOwnerId createdAt description");
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const userId = String(req.user?._id || req.user?.id || "");
    const userRole = String(req.user?.role || "").toLowerCase();

    if (userRole === "supervisor" && String(project.productOwnerId) !== userId) {
      return res.status(403).json({ message: "Unauthorized to access this project" });
    }

    if (userRole !== "admin" && userRole !== "supervisor") {
      const hasProjectTask = await Task.exists({ projectId: project._id, userId: req.user?._id });
      if (!hasProjectTask) {
        return res.status(403).json({ message: "Unauthorized to access this project" });
      }
    }

    const tasks = await Task.find({ projectId: project._id }).select("status completedAt createdAt dueDate");

    const statusCounts = {
      todo: tasks.filter((t) => t.status === "To Do" || t.status === "Backlog").length,
      in_progress: tasks.filter((t) => t.status === "In Progress" || t.status === "Review" || t.status === "Blocked").length,
      done: tasks.filter((t) => t.status === "Done").length,
    };

    const taskCompletionByStatus = [
      { status: "todo", label: "To Do", count: statusCounts.todo },
      { status: "in_progress", label: "In Progress", count: statusCounts.in_progress },
      { status: "done", label: "Done", count: statusCounts.done },
    ];

    const DAY_MS = 24 * 60 * 60 * 1000;
    const SPRINT_DAYS = 14;
    const sprintWindowMs = SPRINT_DAYS * DAY_MS;

    const anchorDate = new Date(project.createdAt);
    anchorDate.setHours(0, 0, 0, 0);

    const dateCandidates = [new Date(project.createdAt), new Date()];
    tasks.forEach((task) => {
      if (task.createdAt) dateCandidates.push(new Date(task.createdAt));
      if (task.dueDate) dateCandidates.push(new Date(task.dueDate));
      if (task.completedAt) dateCandidates.push(new Date(task.completedAt));
    });

    const maxDate = new Date(Math.max(...dateCandidates.map((d) => d.getTime())));
    const sprintCount = Math.max(1, Math.ceil((maxDate.getTime() - anchorDate.getTime() + DAY_MS) / sprintWindowMs));

    const now = new Date();
    const rawActiveIndex = Math.floor((now.getTime() - anchorDate.getTime()) / sprintWindowMs) + 1;
    const activeSprintIndex = Math.min(Math.max(rawActiveIndex, 1), sprintCount);
    const activeSprintStart = new Date(anchorDate.getTime() + (activeSprintIndex - 1) * sprintWindowMs);
    const activeSprintEnd = new Date(activeSprintStart.getTime() + sprintWindowMs - 1);

    const activeSprintTasks = tasks.filter((task) => {
      const pivotDate = task.dueDate || task.createdAt || task.completedAt;
      if (!pivotDate) return false;
      const pivotTime = new Date(pivotDate).getTime();
      return pivotTime >= activeSprintStart.getTime() && pivotTime <= activeSprintEnd.getTime();
    });

    const activeSprintDone = activeSprintTasks.filter((task) => task.status === "Done").length;
    const activeSprintInProgress = activeSprintTasks.filter((task) => task.status === "In Progress" || task.status === "Review" || task.status === "Blocked").length;
    const activeSprintTodo = activeSprintTasks.filter((task) => task.status === "To Do" || task.status === "Backlog").length;

    const velocityBySprint = Array.from({ length: sprintCount }, (_, index) => {
      const start = new Date(anchorDate.getTime() + index * sprintWindowMs);
      const end = new Date(start.getTime() + sprintWindowMs - 1);

      const completed = tasks.filter((task) => {
        if (task.status !== "Done" || !task.completedAt) return false;
        const completedAt = new Date(task.completedAt).getTime();
        return completedAt >= start.getTime() && completedAt <= end.getTime();
      }).length;

      return {
        sprint: `S${index + 1}`,
        completed,
      };
    }).slice(-6);

    return res.status(200).json({
      kpis: {
        totalSprints: sprintCount,
        activeSprint: activeSprintIndex,
        doneTasks: statusCounts.done,
        totalTasks: tasks.length,
        completedSprints: Math.max(0, activeSprintIndex - 1),
      },
      activeSprintSnapshot: {
        name: `Sprint ${activeSprintIndex}`,
        goal: project.description || `Delivery focus for Sprint ${activeSprintIndex}`,
        startDate: activeSprintStart,
        endDate: activeSprintEnd,
        done: activeSprintDone,
        total: activeSprintTasks.length,
        statusBreakdown: {
          todo: activeSprintTodo,
          in_progress: activeSprintInProgress,
          done: activeSprintDone,
        },
      },
      taskCompletionByStatus,
      velocityBySprint,
    });
  } catch (error) {
    console.error("Project chart calculation error:", error);
    return res.status(500).json({ message: "Failed to calculate project chart data" });
  }
};
