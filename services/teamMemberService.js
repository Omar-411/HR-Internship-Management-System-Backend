import mongoose from "mongoose";
import User from "../models/User.js";
import Task from "../models/Task.js";
import Team from "../models/Team.js";
import TeamMember from "../models/TeamMember.js";
import { errors as projectErrors } from "../errors/projectErrors.js";
import { errors } from "../errors/teamErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors as tokenErrors } from "../errors/middlewareTokenErrors.js";
import AppError from "../utils/AppError.js";
import { getAll } from "./handlersFactory.js";
import { isTeamMemberOrProductOwnerOrAdmin } from "../utils/projectHelpers.js";
import { isUserAvailable } from "../validators/userValidators.js";
import { getUserTaskStats } from "./analytics/taskStatsService.js";
import { resolveId } from "../utils/idResolver.js";

// Get the list of team roles
export const getTeamRoles = async () => {
  const roles = TeamMember.schema.path("role").enumValues;

  return {
    status: "Success",
    code: 200,
    message: "Team roles retrieved successfully!",
    data: roles,
  };
};

// Get all team members added to a team
export const getProjectTeamMembers = async (queryParams, teamId, user) => {
  console.log("TEAM FETCH TRACE - ID RECEIVED:", teamId);
  
  // Resolve projectId (teamId here is the projectId from the route)
  const projectMatch = resolveId(teamId);
  const Project = mongoose.model("Project");
  const projectExists = await Project.findOne(projectMatch);
  console.log("TEAM FETCH TRACE - PROJECT EXISTS:", projectExists ? "YES" : "NO");

  if (!projectExists) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Check the team existence by the found project's ObjectId
  let team = await Team.findOne({ projectId: projectExists._id }).populate("projectId");

  if (!team) {
    const projObjectId = projectExists._id;

    // Auto-create team if missing to ensure UI continuity
    console.log(`⚠️ TEAM FETCH TRACE - Auto-creating team for ${teamId}`);
    team = await Team.create({
      name: `${projectExists.name} Team`,
      projectId: projObjectId,
    });

    // CRITICAL: Update the project with the new team_id
    console.log(`⚠️ TEAM FETCH TRACE - Linking team ${team._id} to project ${projObjectId}`);
    await Project.findByIdAndUpdate(projObjectId, { team_id: team._id });

    // Populate the newly created team
    team = await Team.findById(team._id).populate("projectId");
  }

  console.log("TEAM FETCH TRACE - FINAL TEAM OBJECT:", {
    teamId: team?._id,
    projectId: team?.projectId?._id || team?.projectId
  });

  const project = team.projectId;

  // Authorize access to the team members list
  await isTeamMemberOrProductOwnerOrAdmin(team.projectId, user);

  const finalQuery = {
    ...queryParams,
    limit: 6,
    sort: "-createdAt",
    teamId: team._id,
  };

  // Get the list of team members with full user info
  const result = await getAll(
    TeamMember,
    [{ path: "userId", populate: { path: "role_id", select: "name" }, select: "name lastName email profileImageURL role_id" }],
    "--v -teamId",
  )(finalQuery);

  console.log("TEAM FETCH TRACE - MEMBERS FOUND:", result?.data?.length || 0);

  // Get the list of team members
  const members = result.data;

  // Get the task stats for each team member
  const statMembers = await Promise.all(
    members.map(async (member) => {
      // Safety check: if user was deleted but remains in TeamMember collection
      if (!member.userId) {
        return {
          _id: member._id,
          user: { name: "Deleted", lastName: "User" },
          userId: null,
          role: member.role,
          isActiveInProject: member.isActiveInProject,
          stats: { tasksByStatus: { totalTasks: 0, backlog: 0, todo: 0, inProgress: 0, review: 0, done: 0, completionRate: 0 } },
        };
      }

      const stats = await getUserTaskStats(member.userId._id, project._id);

      const userObj = member.userId.toObject();
      if (userObj.role_id) {
        userObj.role = userObj.role_id.name;
      }

      return {
        _id: member._id,
        user: userObj,
        userId: userObj,
        role: member.role,
        isActiveInProject: member.isActiveInProject,
        stats: {
          tasksByStatus: stats
        },
      };
    }),
  );

  return {
    status: "Success",
    code: 200,
    message: "Team members retrieved successfully!",
    data: statMembers,
  };
};

// Get the list team members under a supervisor (We can filter by active and available team members)
export const getSupervisorTeamMembers = async (
  supervisorId,
  currentUser,
  queryParams,
) => {
  // Check user existence
  const supervisorMatch = resolveId(supervisorId);
  const supervisor = await User.findOne(supervisorMatch);
  if (!supervisor) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Authorization: Only the supervisor himself and the Admin can access the list of his team members
  if (
    currentUser.role !== "Admin" &&
    currentUser.id.toString() !== supervisor._id.toString()
  ) {
    throw new AppError(
      tokenErrors.UNAUTHORIZED.message,
      tokenErrors.UNAUTHORIZED.code,
      tokenErrors.UNAUTHORIZED.errorCode,
      tokenErrors.UNAUTHORIZED.suggestion,
    );
  }

  const filters = { ...queryParams };

  // If in the queryParams, isAvailable is set to true, we add the condition to retrieve only available users
  if (queryParams.isAvailable === "true") {
    filters.projectsCount = { lt: 2 };
    delete filters.isAvailable;
  }

  // Inject the filter by the supervisor into the queryParams
  const enrichedQueryParams = {
    ...filters,
    supervisor_id: supervisor._id,
  };

  return await getAll(
    User,
    [
      { path: "role_id", select: "name" },
      { path: "department_id", select: "name" },
    ],
    "-faceDescriptors",
  )(enrichedQueryParams);
};

// Add a team member to a team
export const addTeamMember = async (teamId, userId, role, currentUser) => {
  console.log("PROJECT ID RECEIVED:", teamId);
  console.log("TEAM QUERY:", { projectId: teamId });

  // Check the team existence by projectId since frontend passes projectId as the teamId param
  const projectMatch = resolveId(teamId);
  const Project = mongoose.model("Project");
  const projectExists = await Project.findOne(projectMatch);

  if (!projectExists) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  let team = await Team.findOne({ projectId: projectExists._id }).populate("projectId");
  console.log("TEAM FOUND:", team);

  if (!team) {

    console.log("⚠️ No team found, creating one...");
    team = await Team.create({ name: `${projectExists.name} Team`, projectId: projectExists._id });
    
    // CRITICAL: Link the new team back to the project
    console.log(`⚠️ LINKING NEW TEAM ${team._id} TO PROJECT ${projectExists._id}`);
    await Project.findByIdAndUpdate(projectExists._id, { team_id: team._id });

    // Populate it for the downstream authorization check
    team = await Team.findById(team._id).populate("projectId");
  }

  // Authorize only the Product Owner of the project to add team members
  if (team.projectId.productOwnerId.toString() !== currentUser.id.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_ADD_TEAM_MEMBER.message,
      errors.UNAUTHORIZED_TO_ADD_TEAM_MEMBER.code,
      errors.UNAUTHORIZED_TO_ADD_TEAM_MEMBER.errorCode,
      errors.UNAUTHORIZED_TO_ADD_TEAM_MEMBER.suggestion,
    );
  }

  // Check if the new team member has as supervisor (supervisor_id) = the project product owner
  const userMatch = resolveId(userId);
  const teamMember = await User.findOne(userMatch);
  if (
    !teamMember ||
    teamMember.supervisor_id.toString() !==
      team.projectId.productOwnerId.toString()
  ) {
    throw new AppError(
      errors.TEAM_MEMBER_NOT_AUTHORIZED.message,
      errors.TEAM_MEMBER_NOT_AUTHORIZED.code,
      errors.TEAM_MEMBER_NOT_AUTHORIZED.errorCode,
      errors.TEAM_MEMBER_NOT_AUTHORIZED.suggestion,
    );
  }

  // Check if the user is already a member of the team
  const existingMember = await TeamMember.findOne({ teamId: team._id, userId: teamMember._id });
  if (existingMember) {
    throw new AppError(
      projectErrors.DUPLICATE_USERS.message,
      projectErrors.DUPLICATE_USERS.code,
      projectErrors.DUPLICATE_USERS.errorCode,
      projectErrors.DUPLICATE_USERS.suggestion,
    );
  }

  // Check the role value validity
  const validRoles = TeamMember.schema.path("role").enumValues;
  if (!validRoles.includes(role)) {
    throw new AppError(
      errors.INVALID_ROLE.message,
      errors.INVALID_ROLE.code,
      errors.INVALID_ROLE.errorCode,
      errors.INVALID_ROLE.suggestion,
    );
  }

  // Check if the new team member is assigned the "Scrum Master" role while there is already a scrum master in the team
  if (role === "Scrum Master") {
    const existingScrumMaster = await TeamMember.findOne({
      teamId: team._id,
      role: "Scrum Master",
    });
    if (existingScrumMaster) {
      throw new AppError(
        projectErrors.INVALID_SCRUM_MASTER.message,
        projectErrors.INVALID_SCRUM_MASTER.code,
        projectErrors.INVALID_SCRUM_MASTER.errorCode,
        projectErrors.INVALID_SCRUM_MASTER.suggestion,
      );
    }
  }

  // Check if the new team member is available to take on a new project
  if (!isUserAvailable(teamMember)) {
    throw new AppError(
      commonErrors.USER_UNAVAILABLE.message,
      commonErrors.USER_UNAVAILABLE.code,
      commonErrors.USER_UNAVAILABLE.errorCode,
      commonErrors.USER_UNAVAILABLE.suggestion,
    );
  }

  // Create the new team member
  const newMember = await TeamMember.create({
    teamId: team._id,
    userId: teamMember._id,
    role,
  });

  // Increment the projectsCount of the new team member if the project is active
  if (team.projectId.status === "Active") {
    const updated = await User.findOneAndUpdate(
      {
        _id: teamMember._id,
        projectsCount: { $lt: 2 },
      },
      {
        $inc: { projectsCount: 1 },
      },
      { returnDocument: "after" },
    );

    if (!updated) {
      throw new AppError(
        commonErrors.USER_UNAVAILABLE.message,
        commonErrors.USER_UNAVAILABLE.code,
        commonErrors.USER_UNAVAILABLE.errorCode,
        "User already has 2 active projects and therefore is not available to be added to another Active project.",
      );
    }
  }

  return {
    status: "Success",
    code: 201,
    message: "Team member added successfully!",
    data: newMember,
  };
};

// Update a team member's role + active in project status in the team
export const updateTeamMember = async (
  teamMemberId,
  { role, isActive },
  currentUser,
) => {
  // Check the team member existence
  const member = await TeamMember.findById(teamMemberId).populate({
    path: "teamId",
    populate: { path: "projectId" },
  });
  if (!member) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Get the project object
  const project = member.teamId.projectId;

  // Authorization: Only the Product Owner of the project can update the team members
  if (project.productOwnerId.toString() !== currentUser.id.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_UPDATE_TEAM_MEMBER.message,
      errors.UNAUTHORIZED_TO_UPDATE_TEAM_MEMBER.code,
      errors.UNAUTHORIZED_TO_UPDATE_TEAM_MEMBER.errorCode,
      errors.UNAUTHORIZED_TO_UPDATE_TEAM_MEMBER.suggestion,
    );
  }

  // Update the team member's role
  if (role) {
    // Validate the new role value
    const validRoles = TeamMember.schema.path("role").enumValues;
    if (!validRoles.includes(role)) {
      throw new AppError(
        errors.INVALID_ROLE.message,
        errors.INVALID_ROLE.code,
        errors.INVALID_ROLE.errorCode,
        errors.INVALID_ROLE.suggestion,
      );
    }

    // Scrum Master uniqueness
    if (role === "Scrum Master") {
      const existingScrumMaster = await TeamMember.findOne({
        teamId: member.teamId,
        role: "Scrum Master",
        _id: { $ne: teamMemberId },
      });

      if (existingScrumMaster) {
        throw new AppError(
          projectErrors.INVALID_SCRUM_MASTER.message,
          projectErrors.INVALID_SCRUM_MASTER.code,
          projectErrors.INVALID_SCRUM_MASTER.errorCode,
          projectErrors.INVALID_SCRUM_MASTER.suggestion,
        );
      }
    }

    member.role = role;
  }

  // Update the isActiveInProject status of the team member
  if (isActive !== undefined) {
    // Prevent deactivating a team member with active tasks
    if (isActive === false) {
      const hasActiveTasks = await Task.exists({
        assignedTo: member.userId,
        projectId: project._id,
        status: "In Progress",
      });

      if (hasActiveTasks) {
        throw new AppError(
          errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.message,
          errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.code,
          errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.errorCode,
          errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.suggestion,
        );
      }
    }

    const wasActive = member.isActiveInProject !== false;
    member.isActiveInProject = isActive;

    // Update the projectsCount of the user if the project is active
    if (project.status === "Active") {
      if (wasActive && isActive === false) {
        await User.updateOne(
          { _id: member.userId, projectsCount: { $gt: 0 } },
          { $inc: { projectsCount: -1 } },
        );
      }

      if (!wasActive && isActive === true) {
        const updated = await User.findOneAndUpdate(
          { _id: member.userId, projectsCount: { $lt: 2 } },
          { $inc: { projectsCount: 1 } },
        );

        if (!updated) {
          throw new AppError(
            commonErrors.USER_UNAVAILABLE.message,
            commonErrors.USER_UNAVAILABLE.code,
            commonErrors.USER_UNAVAILABLE.errorCode,
            "User already has 2 active projects",
          );
        }
      }
    }
  }

  // Save the changes
  await member.save();

  return {
    status: "Success",
    message: "Team member updated successfully",
    code: 200,
    data: member,
  };
};

// Remove a team member from a team
export const removeTeamMember = async (teamMemberId, currentUser) => {
  // Check the team member existence
  const member = await TeamMember.findById(teamMemberId).populate({
    path: "teamId",
    populate: { path: "projectId" },
  });
  if (!member)
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );

  // Get the project object
  const project = member.teamId.projectId;

  // Authorize only the Product Owner of the project to remove team members
  if (project.productOwnerId.toString() !== currentUser.id.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_REMOVE_TEAM_MEMBER.message,
      errors.UNAUTHORIZED_TO_REMOVE_TEAM_MEMBER.code,
      errors.UNAUTHORIZED_TO_REMOVE_TEAM_MEMBER.errorCode,
      errors.UNAUTHORIZED_TO_REMOVE_TEAM_MEMBER.suggestion,
    );
  }

  // Check if the team member has active tasks in the project
  const hasActiveTasks = await Task.exists({
    assignedTo: member.userId,
    projectId: project._id,
    status: "In Progress",
  });
  if (hasActiveTasks) {
    throw new AppError(
      errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.message,
      errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.code,
      errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.errorCode,
      errors.TEAM_MEMBER_WITH_ACTIVE_TASKS.suggestion,
    );
  }

  // Unassign the tasks from the removed team member
  await Task.updateMany(
    { assignedTo: member.userId, projectId: project._id },
    { $set: { assignedTo: null } },
  );

  // Decrement the projectsCount of the user if the project is active
  if (project.status === "Active") {
    await User.updateOne(
      { _id: member.userId, projectsCount: { $gt: 0 } },
      { $inc: { projectsCount: -1 } },
    );
  }

  await member.deleteOne();

  return {
    status: "Success",
    code: 200,
    message: "Team member removed successfully",
  };
};

// Replace a team member with another user in the team
export const replaceTeamMember = async (
  oldMemberId,
  newUserId,
  currentUser,
) => {
  // Check the old team member existence
  const oldMember = await TeamMember.findById(oldMemberId).populate({
    path: "teamId",
    populate: { path: "projectId" },
  });
  if (!oldMember)
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );

  // Get the project object
  const project = oldMember.teamId.projectId;

  // Authorize only the Product Owner of the project to replace team members
  if (project.productOwnerId.toString() !== currentUser.id.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_REPLACE_TEAM_MEMBER.message,
      errors.UNAUTHORIZED_TO_REPLACE_TEAM_MEMBER.code,
      errors.UNAUTHORIZED_TO_REPLACE_TEAM_MEMBER.errorCode,
      errors.UNAUTHORIZED_TO_REPLACE_TEAM_MEMBER.suggestion,
    );
  }

  // Check if the new user exists and has as a supervisor (supervisor_id) = the project product owner
  const newUserMatch = resolveId(newUserId);
  const newUser = await User.findOne(newUserMatch);
  if (
    !newUser ||
    newUser.supervisor_id?.toString() !== project.productOwnerId.toString()
  ) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Check if the new user is already a member of the team
  const existingMember = await TeamMember.findOne({
    teamId: oldMember.teamId._id,
    userId: newUser._id,
  });
  if (existingMember) {
    throw new AppError(
      errors.TEAM_MEMBER_ALREADY_EXISTS.message,
      errors.TEAM_MEMBER_ALREADY_EXISTS.code,
      errors.TEAM_MEMBER_ALREADY_EXISTS.errorCode,
      errors.TEAM_MEMBER_ALREADY_EXISTS.suggestion,
    );
  }

  // Check if the new user is available to take on a new project
  if (!isUserAvailable(newUser)) {
    throw new AppError(
      commonErrors.USER_UNAVAILABLE.message,
      commonErrors.USER_UNAVAILABLE.code,
      commonErrors.USER_UNAVAILABLE.errorCode,
      commonErrors.USER_UNAVAILABLE.suggestion,
    );
  }

  // Create new member
  const newMember = await TeamMember.create({
    teamId: oldMember.teamId._id,
    userId: newUser._id,
    role: oldMember.role,
  });

  // Update the projectsCount of the old and new users if the project is active
  if (project.status === "Active") {
    // increment the new user's projectsCount
    const updated = await User.findOneAndUpdate(
      { _id: newUser._id, projectsCount: { $lt: 2 } },
      { $inc: { projectsCount: 1 } },
    );
    if (!updated) {
      throw new AppError(
        commonErrors.USER_UNAVAILABLE.message,
        commonErrors.USER_UNAVAILABLE.code,
        commonErrors.USER_UNAVAILABLE.errorCode,
        "New user already has 2 active projects",
      );
    }

    // decrement the old user's projectsCount
    await User.updateOne(
      { _id: oldMember.userId, projectsCount: { $gt: 0 } },
      { $inc: { projectsCount: -1 } },
    );
  }

  // Transfer the tasks
  await Task.updateMany(
    { assignedTo: oldMember.userId, projectId: project._id },
    { $set: { assignedTo: newUser._id } },
  );

  // Deactivate the old team member
  oldMember.isActiveInProject = false;
  await oldMember.save();

  return {
    status: "Success",
    message: "Team member replaced successfully",
    code: 200,
    data: newMember,
  };
};
