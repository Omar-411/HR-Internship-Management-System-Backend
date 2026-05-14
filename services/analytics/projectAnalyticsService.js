import mongoose from "mongoose";
import Project from "../../models/Project.js";
import { errors } from "../../errors/projectErrors.js";
import { errors as commonErrors } from "../../errors/commonErrors.js";
import AppError from "../../utils/AppError.js";
import { isTeamMemberOrProductOwnerOrAdmin } from "../../utils/projectHelpers.js";
import { getMonthRange } from "../../utils/timeHelpers.js";

import { resolveId } from "../../utils/idResolver.js";

// Get a precise project overview (Stats about sprints, tasks, velocity, etc.)
export const getProjectOverview = async (projectId, currentUser) => {
  // Check the project existence
  const projectMatch = resolveId(projectId);
  const project = await Project.findOne(projectMatch);
  if (!project)
    throw new AppError(
      errors.PROJECT_NOT_FOUND.message,
      errors.PROJECT_NOT_FOUND.code,
      errors.PROJECT_NOT_FOUND.errorCode,
      errors.PROJECT_NOT_FOUND.suggestion,
    );

  // Authorization check: Admin or product owner or team member can access the project overview
  await isTeamMemberOrProductOwnerOrAdmin(project, currentUser);

  // Aggregate the overview data (Sprints stats, Tasks stats, Velocity)
  const [result] = await Project.aggregate([
    { $match: { _id: project._id } },

    {
      $facet: {
        // SPRINT STATS
        sprints: [
          {
            $lookup: {
              from: "sprints",
              localField: "_id",
              foreignField: "projectId",
              as: "sprints",
            },
          },
          { $unwind: { path: "$sprints" } },

          {
            $sort: { "sprints.startDate": 1 },
          },

          {
            $group: {
              _id: null,
              totalSprints: { $sum: 1 },
              doneSprints: {
                $sum: {
                  $cond: [{ $eq: ["$sprints.status", "Completed"] }, 1, 0],
                },
              },
              activeSprintIndex: {
                $push: "$sprints.status",
              },
              sprintList: {
                $push: {
                  _id: "$sprints._id",
                  name: "$sprints.name",
                },
              },
            },
          },
        ],

        // TASK STATS
        tasks: [
          {
            $lookup: {
              from: "tasks",
              localField: "_id",
              foreignField: "projectId",
              as: "tasks",
            },
          },
          { $unwind: { path: "$tasks" } },

          {
            $group: {
              _id: null,
              totalTasks: { $sum: 1 },
              completedTasks: {
                $sum: {
                  $cond: [{ $eq: ["$tasks.status", "Done"] }, 1, 0],
                },
              },
              todo: {
                $sum: {
                  $cond: [{ $eq: ["$tasks.status", "To Do"] }, 1, 0],
                },
              },
              inProgress: {
                $sum: {
                  $cond: [{ $eq: ["$tasks.status", "In Progress"] }, 1, 0],
                },
              },
              done: {
                $sum: {
                  $cond: [{ $eq: ["$tasks.status", "Done"] }, 1, 0],
                },
              },
              allTasks: { $push: "$tasks" },
            },
          },
        ],

        // VELOCITY
        velocity: [
          {
            $lookup: {
              from: "tasks",
              localField: "_id",
              foreignField: "projectId",
              as: "tasks",
            },
          },
          { $unwind: { path: "$tasks", preserveNullAndEmptyArrays: true } },

          // Exclude tasks that are still in the backlog and not assigned to any sprint yet
          {
            $match: {
              "tasks.sprintId": { $ne: null },
            },
          },

          {
            $group: {
              _id: "$tasks.sprintId",
              completedTasks: {
                $sum: {
                  $cond: [{ $eq: ["$tasks.status", "Done"] }, 1, 0],
                },
              },
            },
          },

          {
            $lookup: {
              from: "sprints",
              localField: "_id",
              foreignField: "_id",
              as: "sprint",
            },
          },
          { $unwind: { path: "$sprint", preserveNullAndEmptyArrays: true } },

          {
            $project: {
              sprintName: "$sprint.name",
              completedTasks: 1,
            },
          },

          {
            $sort: { "sprint.startDate": 1 },
          },
        ],
        activeSprint: [
          {
            $lookup: {
              from: "sprints",
              localField: "_id",
              foreignField: "projectId",
              as: "sprints",
            },
          },
          { $unwind: "$sprints" },

          {
            $match: {
              "sprints.status": "Active",
            },
          },

          // Lookup tasks of this sprint
          {
            $lookup: {
              from: "tasks",
              localField: "sprints._id",
              foreignField: "sprintId",
              as: "tasks",
            },
          },

          {
            $addFields: {
              totalTasks: { $size: "$tasks" },
              completedTasks: {
                $size: {
                  $filter: {
                    input: "$tasks",
                    as: "task",
                    cond: { $eq: ["$$task.status", "Done"] },
                  },
                },
              },
            },
          },

          // Sprint review meeting lookup
          {
            $lookup: {
              from: "meetings",
              localField: "sprints._id",
              foreignField: "sprintId",
              as: "meeting",
            },
          },
          {
            $unwind: {
              path: "$meeting",
              preserveNullAndEmptyArrays: true,
            },
          },

          {
            $project: {
              _id: 0,
              sprintId: "$sprints._id",
              sprintNumber: "$sprints.number",
              sprintName: "$sprints.name",
              sprintGoal: "$sprints.goal",
              startDate: "$sprints.startDate",
              endDate: "$sprints.endDate",
              reviewDate: "$meeting.date",
              totalTasks: 1,
              completedTasks: 1,
            },
          },
        ],
      },
    },
  ]);

  // FORMAT RESULT
  const sprintData = result.sprints[0] || {};
  const taskData = result.tasks[0] || {};

  const totalSprints = sprintData.totalSprints || 0;
  const doneSprints = sprintData.doneSprints || 0;

  // Active sprint index
  let activeSprintIndex = null;
  if (sprintData.activeSprintIndex) {
    activeSprintIndex =
      sprintData.activeSprintIndex.findIndex((s) => s === "Active") + 1 || null;
  }

  const activeSprint = result.activeSprint?.[0] || null;

  const totalTasks = taskData.totalTasks || 0;
  const completedTasks = taskData.completedTasks || 0;

  const tasksPercentage =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const sprintPercentage =
    totalSprints === 0 ? 0 : Math.round((doneSprints / totalSprints) * 100);

  let activeSprintData = null;

  if (activeSprint) {
    const progress =
      activeSprint.totalTasks === 0
        ? 0
        : Math.round(
            (activeSprint.completedTasks / activeSprint.totalTasks) * 100,
          );

    activeSprintData = {
      ...activeSprint,
      progress,
    };
  }

  return {
    status: "Success",
    code: 200,
    message: "Project overview retrieved successfully",
    data: {
      summary: {
        totalSprints,
        activeSprintIndex,
        tasks: {
          completed: completedTasks,
          total: totalTasks,
          percentage: tasksPercentage,
        },
        sprints: {
          completed: doneSprints,
          total: totalSprints,
          percentage: sprintPercentage,
        },
      },
      charts: {
        taskStatus: {
          todo: taskData.todo || 0,
          inProgress: taskData.inProgress || 0,
          done: taskData.done || 0,
        },
        velocity: result.velocity || [],
      },
      activeSprint: activeSprintData,
    },
  };
};

// Get project summary per month (Number of projects created each month, completed projects, active projects, etc.)
export const getProjectSummaryPerMonth = async () => {
  const now = new Date();
  const { startOfMonth, endOfMonth } = getMonthRange(now.getFullYear(), now.getMonth() + 1);
  
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);

  const result = await Project.aggregate([
    {
      $facet: {
        // Total projects created this month
        totalCreated: [
          {
            $match: {
              createdAt: { $gte: startOfMonth, $lte: endOfMonth },
            },
          },
          { $count: "value" },
        ],

        // Total "Active" projects this month
        active: [
          {
            $match: {
              status: "Active",
              createdAt: { $gte: startOfMonth, $lte: endOfMonth },
            },
          },
          { $count: "value" },
        ],

        // Total "Completed" projects this month
        completed: [
          {
            $match: {
              completedAt: { $gte: startOfMonth, $lte: endOfMonth },
            },
          },
          { $count: "value" },
        ],
      },
    },
  ]);

  const data = result[0] || {};

  return {
    status: "Success",
    code: 200,
    message: "Project summary per month retrieved successfully",
    data: {
      totalCreated: data.totalCreated?.[0]?.value || 0,
      active: data.active?.[0]?.value || 0,
      completed: data.completed?.[0]?.value || 0,
    },
  };
};

// Get global project stats (Total number of projects, completed projects, active projects, completion rate)
export const getGlobalProjectStats = async () => {
  // Get the total number of projects
  const total = await Project.countDocuments();

  // Get the number of completed projects
  const completed = await Project.countDocuments({
    status: "Completed",
  });

  // Calculate the completion rate
  const completionRate = total === 0 ? 0 : (completed / total) * 100;

  // Get the number of active projects
  const active = await Project.countDocuments({
    status: "Active",
  });

  return {
    status: "Success",
    code: 200,
    message: "Global project stats retrieved successfully",
    data: {
      totalProjects: total,
      completedProjects: completed,
      activeProjects: active,
      completionRate: Math.round(completionRate),
    },
  };
};
