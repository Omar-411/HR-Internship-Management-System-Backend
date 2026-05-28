import mongoose from "mongoose";
import Team from "../models/Team.js";
import TeamMember from "../models/TeamMember.js";
import User from "../models/User.js";
import Project from "../models/Project.js";
import { errors } from "../errors/projectErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors as teamErrors } from "../errors/teamErrors.js";
import AppError from "./AppError.js";
import { isUserAvailable } from "../validators/userValidators.js";
import {
  incrementUsersProjectCount,
  decrementUsersProjectCount,
} from "./projectCountHelper.js";
import { resolveId } from "./idResolver.js";

// Check if the user is a team member, product owner of the project or admins to allow access to the project resources
export const isTeamMemberOrProductOwnerOrAdmin = async (
  project,
  user,
  errorMessage = errors.UNAUTHORIZED_TO_ACCESS_PROJECT,
) => {
  const userId = user.id;

  // Owner ALWAYS allowed bypass
  if (project.productOwnerId.toString() === userId.toString()) {
    return;
  }

  // Admin ALWAYS allowed bypass
  if (user.role === "Admin") {
    return;
  }

  const membership = await TeamMember.findOne({
    userId,
    teamId: project.team_id,
  });

  console.log("[AUTH-TRACE] - Membership Found:", !!membership);

  if (!membership) {
    throw new AppError(
      errorMessage.message,
      errorMessage.code,
      errorMessage.errorCode,
      errorMessage.suggestion,
    );
  }
};

// Build the match filter for the getAllProjects
export const buildProjectMatchFilter = async ({
  userId,
  role,
  name,
  sector,
  status,
  supervisor,
  startDate,
  endDate,
  archived,
  aiEvaluationStatus,
}) => {
  const match = {};

  /*
    Authorization Access: Admins can access all projects, supervisors can access projects they are product owners of, 
    and employees/interns can access projects where they are team members
  */
  const normalizedRole = role?.toLowerCase();

  if (normalizedRole !== "admin") {
    if (normalizedRole === "supervisor") {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new AppError(commonErrors.INVALID_ID.message, commonErrors.INVALID_ID.code);
      }

      match.productOwnerId = new mongoose.Types.ObjectId(userId);
    } else {
      const teams = await TeamMember.find({ userId }).select("teamId");
      const teamIds = teams.map((t) => t.teamId);

      match.team_id = {
        $in: teamIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id)),
      };
    }
  }

  // Filter by the archived status
  if (archived === "true") match.status = "Archived";
  else match.status = { $ne: "Archived" };

  // Filters
  if (name) match.name = { $regex: name, $options: "i" };
  if (sector) match.sector = sector;
  if (status) match.status = status;

  if (startDate || endDate) match.startDate = {};
  if (startDate) match.startDate.$gte = new Date(startDate);
  if (endDate) match.startDate.$lte = new Date(endDate);

  if (supervisor) {
    const user = await User.findOne({
      $or: [
        { name: { $regex: supervisor, $options: "i" } },
        { lastName: { $regex: supervisor, $options: "i" } },
      ],
    });

    match.productOwnerId = user ? user._id : null;
  }

  if (aiEvaluationStatus) {
    const allowedAiStatuses = Project.schema.path("aiEvaluationStatus").enumValues;
    if (!allowedAiStatuses.includes(aiEvaluationStatus)) {
      throw new AppError(
        errors.INVALID_AI_EVALUATION_STATUS.message,
        errors.INVALID_AI_EVALUATION_STATUS.code,
        errors.INVALID_AI_EVALUATION_STATUS.errorCode,
        errors.INVALID_AI_EVALUATION_STATUS.suggestion,
      );
    }

    if (aiEvaluationStatus === "Pending") {
      match.$and = [
        ...(match.$and || []),
        {
          $or: [
            { aiEvaluationStatus: "Pending" },
            { aiEvaluationStatus: { $exists: false } },
            { aiEvaluationStatus: null },
          ],
        },
      ];
    } else {
      match.aiEvaluationStatus = aiEvaluationStatus;
    }
  }

  return match;
};

// Build the match filter for accessing a specific project by ID
export const buildProjectAccessMatch = async (projectId, userId, role) => {
  const match = resolveId(projectId);
  
  // Handle the case where the match is an $or condition (e.g., for team members or supervisors)
  if (match.$or) {
    match.$or = match.$or.map(clause => {
      if (clause._id && typeof clause._id === 'string' && mongoose.Types.ObjectId.isValid(clause._id)) {
        return { ...clause, _id: new mongoose.Types.ObjectId(clause._id) };
      }
      return clause;
    });
  } else if (match._id && typeof match._id === 'string' && mongoose.Types.ObjectId.isValid(match._id)) {
    match._id = new mongoose.Types.ObjectId(match._id);
  }

  const normalizedRole = role?.toLowerCase();

  if (normalizedRole === "supervisor") {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError(commonErrors.INVALID_ID.message, commonErrors.INVALID_ID.code);
    }
    match.productOwnerId = new mongoose.Types.ObjectId(userId);
  }

  if (normalizedRole === "employee" || normalizedRole === "intern") {
    const teams = await TeamMember.find({ userId }).select("teamId");

    if (!teams.length) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_ACCESS_PROJECT.message,
        errors.UNAUTHORIZED_TO_ACCESS_PROJECT.code,
        errors.UNAUTHORIZED_TO_ACCESS_PROJECT.errorCode,
        errors.UNAUTHORIZED_TO_ACCESS_PROJECT.suggestion,
      );
    }

    match.team_id = {
      $in: teams.filter(t => mongoose.Types.ObjectId.isValid(t.teamId)).map((t) => new mongoose.Types.ObjectId(t.teamId)),
    };
  }

  return match;
};

// Validate input data for creating a project
export const validateCreateProject = async (data, productOwnerId) => {
  const { name, sector, startDate, dueDate, scrumMasterId, requiredTech, rolesNeeded } = data;

  // Check for required fields
  if (!name || !sector || !startDate || !dueDate) {
    throw new AppError(
      errors.MISSING_REQUIRED_FIELDS.message,
      errors.MISSING_REQUIRED_FIELDS.code,
      errors.MISSING_REQUIRED_FIELDS.errorCode,
      errors.MISSING_REQUIRED_FIELDS.suggestion,
    );
  }

  // Check the project name uniqueness
  const existingProject = await Project.findOne({ name });
  if (existingProject) {
    throw new AppError(
      errors.PROJECT_EXISTS.message,
      errors.PROJECT_EXISTS.code,
      errors.PROJECT_EXISTS.errorCode,
      errors.PROJECT_EXISTS.suggestion,
    );
  }

  // Validate the sector
  const allowedSectors = Project.schema.path("sector").enumValues;
  if (!allowedSectors.includes(sector)) {
    throw new AppError(
      errors.INVALID_SECTOR.message,
      errors.INVALID_SECTOR.code,
      errors.INVALID_SECTOR.errorCode,
      errors.INVALID_SECTOR.suggestion,
    );
  }

  if (
    (requiredTech !== undefined && !Array.isArray(requiredTech)) ||
    (rolesNeeded !== undefined && !Array.isArray(rolesNeeded)) ||
    (Array.isArray(requiredTech) && requiredTech.some((value) => typeof value !== "string")) ||
    (Array.isArray(rolesNeeded) && rolesNeeded.some((value) => typeof value !== "string"))
  ) {
    throw new AppError(
      errors.INVALID_REQUIREMENTS.message,
      errors.INVALID_REQUIREMENTS.code,
      errors.INVALID_REQUIREMENTS.errorCode,
      errors.INVALID_REQUIREMENTS.suggestion,
    );
  }

  // Validate the due date is after the start date
  if (new Date(dueDate) < new Date(startDate)) {
    throw new AppError(
      errors.INVALID_DUE_DATE.message,
      errors.INVALID_DUE_DATE.code,
      errors.INVALID_DUE_DATE.errorCode,
      errors.INVALID_DUE_DATE.suggestion,
    );
  }

  if (scrumMasterId) {
    // Check the scrum master existence
    const scrumMaster = await User.findById(scrumMasterId).populate("role_id");
    if (!scrumMaster) {
      throw new AppError(
        commonErrors.USER_NOT_FOUND.message,
        commonErrors.USER_NOT_FOUND.code,
        commonErrors.USER_NOT_FOUND.errorCode,
        commonErrors.USER_NOT_FOUND.suggestion,
      );
    }

    // Check the scrum master is under the same supervisor as the product owner
    if (scrumMaster.supervisor_id.toString() !== productOwnerId.toString()) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_ASSIGN_SCRUM_MASTER.message,
        errors.UNAUTHORIZED_TO_ASSIGN_SCRUM_MASTER.code,
        errors.UNAUTHORIZED_TO_ASSIGN_SCRUM_MASTER.errorCode,
        errors.UNAUTHORIZED_TO_ASSIGN_SCRUM_MASTER.suggestion,
      );
    }

    // Check the scrum master is not an intern
    if (scrumMaster.role_id.name === "Intern") {
      throw new AppError(
        errors.INVALID_SCRUM_MASTER.message,
        errors.INVALID_SCRUM_MASTER.code,
        errors.INVALID_SCRUM_MASTER.errorCode,
        errors.INVALID_SCRUM_MASTER.suggestion,
      );
    }

    // Check the scrum master is available to take on a new project
    if (!isUserAvailable(scrumMaster)) {
      throw new AppError(
        commonErrors.USER_UNAVAILABLE.message,
        commonErrors.USER_UNAVAILABLE.code,
        commonErrors.USER_UNAVAILABLE.errorCode,
        commonErrors.USER_UNAVAILABLE.suggestion,
      );
    }
  }
};

// Normalize the required technologies and roles
export const normalizeProjectRequirements = (values = []) => {
  if (
    !Array.isArray(values) ||
    values.some((value) => typeof value !== "string")
  ) {
    throw new AppError(
      errors.INVALID_REQUIREMENTS.message,
      errors.INVALID_REQUIREMENTS.code,
      errors.INVALID_REQUIREMENTS.errorCode,
      errors.INVALID_REQUIREMENTS.suggestion,
    );
  }

  return [...new Set(
    values
      .map((value) => value.trim())
      .filter(Boolean),
  )];
};

// Reset the AI evaluation fields
export const resetProjectAiEvaluation = (project) => {
  project.aiEvaluationStatus = "Pending";
  project.aiEvaluationResult = null;
  project.aiEvaluationError = null;
  project.aiEvaluatedAt = null;
  project.aiEvaluatedBy = null;
};

// Helper function to throw a locked error when trying to update locked fields in the project
export const throwLocked = () => {
  throw new AppError(
    errors.PROJECT_STATE_LOCKED.message,
    errors.PROJECT_STATE_LOCKED.code,
    errors.PROJECT_STATE_LOCKED.errorCode,
    errors.PROJECT_STATE_LOCKED.suggestion,
  );
};

// Apply the updates to the project object based on the input data
export const applyProjectUpdates = async (project, data, isLocked) => {
  const {
    name,
    sector,
    description,
    requiredTech,
    rolesNeeded,
    startDate,
    dueDate,
    status,
    onHoldReason,
  } = data;

  // Check the team existence
  const team = await Team.findById(project.team_id);
  if (!team) {
    throw new AppError(
      errors.TEAM_NOT_FOUND.message,
      errors.TEAM_NOT_FOUND.code,
      errors.TEAM_NOT_FOUND.errorCode,
      errors.TEAM_NOT_FOUND.suggestion,
    );
  }

  // Get the team members
  const members = await TeamMember.find({ teamId: team._id });

  // Project name update
  if (name && name !== project.name) {
    if (isLocked) throwLocked();
    project.name = name;
    resetProjectAiEvaluation(project);
  }

  // Project sector update
  if (sector) {
    if (isLocked) throwLocked();

    const allowed = Project.schema.path("sector").enumValues;
    if (!allowed.includes(sector)) {
      throw new AppError(
        errors.INVALID_SECTOR.message,
        errors.INVALID_SECTOR.code,
        errors.INVALID_SECTOR.errorCode,
        errors.INVALID_SECTOR.suggestion,
      );
    }

    project.sector = sector;
    resetProjectAiEvaluation(project);
  }

  // Project description update
  if (description !== undefined) {
    if (isLocked) throwLocked();
    project.description = description;
    resetProjectAiEvaluation(project);
  }

  if (requiredTech !== undefined) {
    if (isLocked) throwLocked();
    project.requiredTech = normalizeProjectRequirements(requiredTech);
    resetProjectAiEvaluation(project);
  }

  if (rolesNeeded !== undefined) {
    if (isLocked) throwLocked();
    project.rolesNeeded = normalizeProjectRequirements(rolesNeeded);
    resetProjectAiEvaluation(project);
  }

  // Project dates update
  if (startDate || dueDate) {
    if (isLocked) throwLocked();

    const newStart = startDate ? new Date(startDate) : project.startDate;
    const newDue = dueDate ? new Date(dueDate) : project.dueDate;

    if (newDue < newStart) {
      throw new AppError(
        errors.INVALID_DUE_DATE.message,
        errors.INVALID_DUE_DATE.code,
        errors.INVALID_DUE_DATE.errorCode,
        errors.INVALID_DUE_DATE.suggestion,
      );
    }

    project.startDate = newStart;
    project.dueDate = newDue;
  }

  // Project status update
  if (status) {
    const oldStatus = project.status;

    // Validate the new status value
    const allowedStatuses = Project.schema.path("status").enumValues;
    if (!allowedStatuses.includes(status)) {
      throw new AppError(
        errors.INVALID_STATUS.message,
        errors.INVALID_STATUS.code,
        errors.INVALID_STATUS.errorCode,
        errors.INVALID_STATUS.suggestion,
      );
    }

    const newStatus = status;

    // On hold status case
    if (newStatus === "On Hold") {
      project.onHoldReason = onHoldReason || project.onHoldReason;
    } else {
      project.onHoldReason = null;
    }

    // Completed status case
    if (newStatus === "Completed") {
      project.completedAt = new Date();
    }

    // Active status case
    if (newStatus === "Active") {
      if (!project.scrumMasterId) {
        throw new AppError(
          errors.SCRUM_MASTER_REQUIRED.message,
          errors.SCRUM_MASTER_REQUIRED.code,
          errors.SCRUM_MASTER_REQUIRED.errorCode,
          errors.SCRUM_MASTER_REQUIRED.suggestion,
        );
      }

      if (members.length < 1) {
        throw new AppError(
          errors.TEAM_MEMBERS_REQUIRED.message,
          errors.TEAM_MEMBERS_REQUIRED.code,
          errors.TEAM_MEMBERS_REQUIRED.errorCode,
          errors.TEAM_MEMBERS_REQUIRED.suggestion,
        );
      }
    }
    project.status = newStatus;

    // Get active team members
    const activeMembers = members
      .filter((m) => m.isActiveInProject !== false)
      .map((m) => m.userId);

    // Transition logic
    if (oldStatus !== "Active" && newStatus === "Active") {
      await incrementUsersProjectCount(activeMembers);
    }

    if (oldStatus === "Active" && newStatus !== "Active") {
      await decrementUsersProjectCount(activeMembers);
    }
  }
};
