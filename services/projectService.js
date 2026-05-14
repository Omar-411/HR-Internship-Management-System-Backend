import mongoose from "mongoose";
import Project from "../models/Project.js";
import Sprint from "../models/Sprint.js";
import Task from "../models/Task.js";
import Team from "../models/Team.js";
import TeamMember from "../models/TeamMember.js";
import User from "../models/User.js";
import Document from "../models/Document.js";
import { errors } from "../errors/projectErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import AppError from "../utils/AppError.js";
import { deleteFromCloudinary } from "../utils/cloudinaryHelper.js";
import { 
  isTeamMemberOrProductOwnerOrAdmin,
  buildProjectMatchFilter,  
  buildProjectAccessMatch, 
  validateCreateProject, 
  validateTeamMembers,
  applyProjectUpdates,
} from "../utils/projectHelpers.js";
import { 
  isProjectCompletedOrOnHold, 
  isProjectInactive,
  ensureCanUpdateProject,
} from "../validators/projectValidators.js";
import { decrementUsersProjectCount } from "../utils/projectCountHelper.js";
import { resolveId } from "../utils/idResolver.js";

// Get the list of the sectors (For the dropdown in the project filters)
export const getAllSectors = async () => {
  const sectors = Project.schema.path("sector").enumValues;

  return {
    status: "Success",
    message: "Sectors retrieved successfully!",
    code: 200,
    data: sectors,
  };
};

// Get all project statuses except "Archived" (For the dropdown in the project filters, "Archived" is in a different section in the frontend)
export const getAllStatuses = async () => {
  const statuses = Project.schema
    .path("status")
    .enumValues.filter((s) => s !== "Archived");

  return {
    status: "Success",
    message: "Statuses retrieved successfully!",
    code: 200,
    data: statuses,
  };
};

// Get all projects (12 projects per page)
export const getAllProjects = async (req) => {
  const {
    page = 1,
    name,
    sector,
    status, // Project status filter except "Archived"
    supervisor, // Supervisor name filter (e.g. "Omar Ajimi")
    startDate,
    endDate,
    archived = "false",
  } = req.query;

  const limit = 12; // 12 projects per page
  const parsedPage = Math.max(parseInt(page), 1);
  const skip = (parsedPage - 1) * limit;

  // Get the user info from the token
  const { id: userId, role } = req.user;

  // Build the project match filter
  const match = await buildProjectMatchFilter({
    userId,
    role,
    name,
    sector,
    status,
    supervisor,
    startDate,
    endDate,
    archived,
  });

  // Aggregate the project info with the related data (Product owner, Team members, Current sprint, Tasks stats).
  const projects = await Project.aggregate([
    { $match: match },

    {
      $lookup: {
        from: "users",
        localField: "productOwnerId",
        foreignField: "_id",
        as: "productOwner",
      },
    },
    { $unwind: { path: "$productOwner", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "teammembers",
        localField: "team_id",
        foreignField: "teamId",
        as: "teamMembers",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "teamMembers.userId",
        foreignField: "_id",
        as: "teamUsers",
      },
    },
    {
      $addFields: {
        teamImages: {
          $map: {
            input: "$teamUsers",
            as: "user",
            in: "$$user.profileImageURL",
          },
        },
      },
    },

    {
      $lookup: {
        from: "sprints",
        let: { projectId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$projectId", "$$projectId"] },
                  { $eq: ["$status", "Active"] },
                ],
              },
            },
          },
        ],
        as: "currentSprint",
      },
    },
    { $unwind: { path: "$currentSprint", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "tasks",
        let: { projectId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$projectId", "$$projectId"] },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              completed: {
                $sum: {
                  $cond: [{ $eq: ["$status", "Done"] }, 1, 0],
                },
              },
            },
          },
        ],
        as: "taskStats",
      },
    },

    {
      $addFields: {
        totalTasks: {
          $ifNull: [{ $arrayElemAt: ["$taskStats.total", 0] }, 0],
        },
        completedTasks: {
          $ifNull: [{ $arrayElemAt: ["$taskStats.completed", 0] }, 0],
        },
      },
    },
    {
      $addFields: {
        progress: {
          $cond: [
            { $eq: ["$totalTasks", 0] },
            0,
            {
              $round: [
                {
                  $multiply: [
                    { $divide: ["$completedTasks", "$totalTasks"] },
                    100,
                  ],
                },
                0,
              ],
            },
          ],
        },
      },
    },

    {
      $project: {
        name: 1,
        description: 1,
        sector: 1,
        status: 1,
        startDate: 1,
        dueDate: 1,
        productOwner: {
          _id: "$productOwner._id",
          name: "$productOwner.name",
          lastName: "$productOwner.lastName",
          profileImageURL: "$productOwner.profileImageURL",
        },
        teamImages: 1,
        currentSprint: {
          _id: "$currentSprint._id",
          name: "$currentSprint.name",
          number: "$currentSprint.number",
          status: "$currentSprint.status",
        },
        totalTasks: 1,
        completedTasks: 1,
        progress: 1,
      },
    },

    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);

  // Get the total count of projects (Dynamic project counts based on the filter conditions)
  const totalProjects = await Project.countDocuments(match);

  return {
    status: "Success",
    code: 200,
    message: "List of Projects retrieved successfully!",
    data: projects,
    pagination: {
      currentPage: parsedPage,
      totalPages: Math.ceil(totalProjects / limit),
      limitPerPage: limit,
      totalCount: totalProjects,
    },
  };
};

// Get a project by Id
export const getProjectById = async (projectId, user) => {
  const { role, id: userId } = user;

  // Check existence
  const existingProject = await Project.findOne(resolveId(projectId));
  if (!existingProject) {
    throw new AppError(
      errors.PROJECT_NOT_FOUND.message,
      errors.PROJECT_NOT_FOUND.code,
      errors.PROJECT_NOT_FOUND.errorCode,
      errors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  const actualProjectId = existingProject._id;

  // Authorization filter
  const match = await buildProjectAccessMatch(projectId, userId, role);

  const project = await Project.aggregate([
    { $match: match },

    // Product owner
    {
      $lookup: {
        from: "users",
        localField: "productOwnerId",
        foreignField: "_id",
        as: "productOwner",
      },
    },
    { $unwind: { path: "$productOwner", preserveNullAndEmptyArrays: true } },

    // Team
    {
      $lookup: {
        from: "teams",
        localField: "team_id",
        foreignField: "_id",
        as: "team",
      },
    },
    { $unwind: { path: "$team", preserveNullAndEmptyArrays: true } },

    // Team members
    {
      $lookup: {
        from: "teammembers",
        localField: "team._id",
        foreignField: "teamId",
        as: "teamMembers",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "teamMembers.userId",
        foreignField: "_id",
        as: "teamMembersInfo",
      },
    },

    // Related data counts (Tasks, Sprints, Documents)
    {
      $lookup: {
        from: "tasks",
        localField: "_id",
        foreignField: "projectId",
        as: "tasks",
      },
    },
    {
      $lookup: {
        from: "sprints",
        localField: "_id",
        foreignField: "projectId",
        as: "sprints",
      },
    },
    {
      $lookup: {
        from: "documents",
        localField: "_id",
        foreignField: "projectId",
        as: "documents",
      },
    },
    {
      $addFields: {
        tasksCount: { $size: "$tasks" },
        sprintsCount: { $size: "$sprints" },
        documentsCount: { $size: "$documents" },
      },
    },

    {
      $project: {
        tasks: 0,
        sprints: 0,
        documents: 0,
      },
    },

    // Clean sensitive fields
    {
      $unset: [
        "__v",
        "team.__v",
        "teamMembers.__v",
        "teamMembersInfo.__v",
        "productOwner.__v",
        "productOwner.faceDescriptors",
        "teamMembersInfo.faceDescriptors",
      ],
    },
  ]);

  if (!project.length) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_ACCESS_PROJECT.message,
      errors.UNAUTHORIZED_TO_ACCESS_PROJECT.code,
      errors.UNAUTHORIZED_TO_ACCESS_PROJECT.errorCode,
      errors.UNAUTHORIZED_TO_ACCESS_PROJECT.suggestion,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Project retrieved successfully!",
    data: project[0],
  };
};

// Create a new project
export const createProject = async (data, user) => {
  // Start a session for transaction (All is created or nothing)
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      name,
      sector,
      description,
      startDate,
      dueDate,
      scrumMasterId,
      teamMembers = [],
    } = data;

    // Take the product owner ID from the token
    const productOwnerId = user.id; 

    // Validate the input data
    await validateCreateProject(data, productOwnerId);

    // Create the new project
    const project = await Project.create(
      [
        {
          name: name.trim(),
          sector,
          status: "Planning",
          description,
          startDate,
          dueDate,
          productOwnerId,
          scrumMasterId: scrumMasterId || null,
        },
      ],
      { session }
    );

    const createdProject = project[0];

    // Create the project team automatically
    const team = await Team.create(
      [
        {
          name: `The ${name.trim()} Team`,
          projectId: createdProject._id,
        },
      ],
      { session }
    );

    const createdTeam = team[0];

    // Prepare the team members (Including the Scrum Master if provided)
    const membersToInsert = [
      ...(scrumMasterId
        ? [
            {
              teamId: createdTeam._id,
              userId: scrumMasterId,
              role: "Scrum Master",
            },
          ]
        : []),
      ...teamMembers.map((m) => ({
        teamId: createdTeam._id,
        userId: m.userId,
        role: m.role,
      })),
    ];

    let createdMembers = [];

    if (membersToInsert.length > 0) {
      await validateTeamMembers(membersToInsert, teamMembers, productOwnerId);

      createdMembers = await TeamMember.insertMany(membersToInsert, {
        session,
      });
    }

    // Link the team to the project
    createdProject.team_id = createdTeam._id;
    await createdProject.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return {
      status: "Success",
      code: 201,
      message: "Project created successfully!",
      data: {
        project: createdProject,
        team: createdTeam,
        teamMembers: createdMembers,
      },
    };
  } catch (err) {
    // Automatic rollback
    await session.abortTransaction();
    session.endSession();

    throw err;
  }
};

// Update a project 
export const updateProject = async (projectId, data, userId) => {
  // Check the project existence
  const project = await Project.findOne(resolveId(projectId));
  if (!project) {
    throw new AppError(
      errors.PROJECT_NOT_FOUND.message,
      errors.PROJECT_NOT_FOUND.code,
      errors.PROJECT_NOT_FOUND.errorCode,
      errors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Ensure that the project is not archived + the product owner of the project is the one making the update request (Not any product owner)
  ensureCanUpdateProject(project, userId);

  // Check if the project is completed or on hold
  const isLocked = isProjectCompletedOrOnHold(project);

  await applyProjectUpdates(project, data, isLocked);

  await project.save();

  return {
    status: "Success",
    code: 200,
    message: "Project updated successfully!",
    data: project,
  };
};

// Archive a project
export const archiveProject = async (projectId, userId) => {
  // Check the project existence
  const project = await Project.findOne(resolveId(projectId));
  if (!project) {
    throw new AppError(
      errors.PROJECT_NOT_FOUND.message,
      errors.PROJECT_NOT_FOUND.code,
      errors.PROJECT_NOT_FOUND.errorCode,
      errors.PROJECT_NOT_FOUND.suggestion
    );
  }

  // Access control: Only the product owner of the project can archive it, not any product owner
  if (project.productOwnerId.toString() !== userId.toString()) {
    throw new AppError(
      errors.PROJECT_FORBIDDEN_ACTION.message,
      errors.PROJECT_FORBIDDEN_ACTION.code,
      errors.PROJECT_FORBIDDEN_ACTION.errorCode,
      errors.PROJECT_FORBIDDEN_ACTION.suggestion
    );
  }

  // Prevent the double archive
  if (project.status === "Archived") {
    throw new AppError(
      errors.PROJECT_ALREADY_ARCHIVED.message,
      errors.PROJECT_ALREADY_ARCHIVED.code,
      errors.PROJECT_ALREADY_ARCHIVED.errorCode,
      errors.PROJECT_ALREADY_ARCHIVED.suggestion
    );
  }

  // Get active team members
  const members = await TeamMember.find({ teamId: project.team_id });

  const activeMembers = members
    .filter(m => m.isActiveInProject !== false)
    .map(m => m.userId);

  // If project was Active, decrement the projectsCount of the active members
  if (project.status === "Active") {
    await decrementUsersProjectCount(activeMembers);
  }

  // Archive project
  project.status = "Archived";
  project.onHoldReason = null;

  await project.save();

  return {
    status: "Success",
    code: 200,
    message: "Project archived successfully!",
    data: project,
  };
};

// Restore a project
export const restoreProject = async (projectId, userId) => {
  const project = await Project.findOne(resolveId(projectId));
  if (!project) {
    throw new AppError(
      errors.PROJECT_NOT_FOUND.message,
      errors.PROJECT_NOT_FOUND.code,
      errors.PROJECT_NOT_FOUND.errorCode,
      errors.PROJECT_NOT_FOUND.suggestion
    );
  }

  // Access control: Only the product owner of the project can restore it, not any product owner
  if (project.productOwnerId.toString() !== userId.toString()) {
    throw new AppError(
      errors.PROJECT_FORBIDDEN_ACTION.message,
      errors.PROJECT_FORBIDDEN_ACTION.code,
      errors.PROJECT_FORBIDDEN_ACTION.errorCode,
      errors.PROJECT_FORBIDDEN_ACTION.suggestion
    );
  }

  // Only archived projects can be restored
  if (project.status !== "Archived") {
    throw new AppError(
      errors.INVALID_RESTORE_STATE.message,
      errors.INVALID_RESTORE_STATE.code,
      errors.INVALID_RESTORE_STATE.errorCode,
      errors.INVALID_RESTORE_STATE.suggestion
    );
  }

  // Restore project
  project.status = "Planning";
  await project.save();

  return {
    status: "Success",
    code: 200,
    message: "Project restored successfully!",
    data: project,
  };
};

// Delete a project (Admin only)
export const deleteProject = async (projectId) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Check project existence
    const project = await Project.findOne(resolveId(projectId)).session(session);
    if (!project) {
      throw new AppError(
        errors.PROJECT_NOT_FOUND.message,
        errors.PROJECT_NOT_FOUND.code,
        errors.PROJECT_NOT_FOUND.errorCode,
        errors.PROJECT_NOT_FOUND.suggestion
      );
    }

    // Get active team members to update their projectsCount if the project is active
    const members = await TeamMember.find({ teamId: project.team_id });
    const activeMembers = members
      .filter(m => m.isActiveInProject !== false)
      .map(m => m.userId);

    if (project.status === "Active") {
      await decrementUsersProjectCount(activeMembers, session);
    }

    const projectIdObj = project._id;

    // Delete the project dependent data (Team, Team Members, Tasks, Sprints, Documents) before deleting the project itself
    await TeamMember.deleteMany({ teamId: project.team_id }).session(session);

    await Team.findByIdAndDelete(project.team_id).session(session);

    await Task.deleteMany({ projectId: projectIdObj }).session(session);

    await Sprint.deleteMany({ projectId: projectIdObj }).session(session);

    await Document.deleteMany({ projectId: projectIdObj }).session(session);

    await Project.findByIdAndDelete(projectIdObj).session(session);

    // Commit DB changes 
    await session.commitTransaction();
    session.endSession();

    // Delete the project documents from cloudinary
    const documents = await Document.find({ projectId: projectIdObj });
    for (const doc of documents) {
      try {
        await deleteFromCloudinary(doc.filePublicId, "raw");
      } catch (cloudErr) {
        console.log("Cloudinary Deletion failed:", cloudErr.message);
      }
    }

    return {
      status: "Success",
      code: 200,
      message: "Project Deleted successfully!",
    };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};
