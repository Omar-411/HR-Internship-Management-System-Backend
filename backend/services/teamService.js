import Team from "../models/Team.js";
import { getOne, updateOne } from "./handlersFactory.js";
import { errors } from "../errors/projectErrors.js";
import { errors as teamErrors } from "../errors/teamErrors.js";
import AppError from "../utils/AppError.js";
import { isTeamMemberOrProductOwnerOrAdmin } from "../utils/projectHelpers.js";
import { isEmpty } from "../validators/userValidators.js";

// Get team by ID
export const getTeamById = async (teamId, currentUser) => {
  // Check the team existence
  const team = await Team.findById(teamId);
  if (!team) {
    throw new AppError(
      errors.TEAM_NOT_FOUND.message,
      errors.TEAM_NOT_FOUND.code,
      errors.TEAM_NOT_FOUND.errorCode,
      errors.TEAM_NOT_FOUND.suggestion,
    );
  }

  // Get the project product owner Id to check the user's access to the team details (In case of Product owner access)
  await team.populate("projectId", "productOwnerId");
  const project = team.projectId;

  // Authorize access to the team details (Admin, Product Owner, and the project team members can access the team details)
  await isTeamMemberOrProductOwnerOrAdmin(project,currentUser);

  return await getOne(Team, errors.TEAM_NOT_FOUND, [
    { path: "projectId", select: "name sector status" },
  ])(teamId);
};

// Update the team name
export const updateTeamName = async (teamId, newName, userId) => {
  // Check the team existence
  const team = await Team.findById(teamId).populate("projectId");
  if (!team) {
    throw new AppError(
      errors.TEAM_NOT_FOUND.message,
      errors.TEAM_NOT_FOUND.code,
      errors.TEAM_NOT_FOUND.errorCode,
      errors.TEAM_NOT_FOUND.suggestion
    );
  }

  // Authorization access: Only the Product Owner of the project has the access to update the team name
  const project = team.projectId;
  if (project.productOwnerId.toString() !== userId.toString()) {
    throw new AppError(
      teamErrors.UNAUTHORIZED_TO_UPDATE_TEAM.message,
      teamErrors.UNAUTHORIZED_TO_UPDATE_TEAM.code,
      teamErrors.UNAUTHORIZED_TO_UPDATE_TEAM.errorCode,
      teamErrors.UNAUTHORIZED_TO_UPDATE_TEAM.suggestion
    );
  }

  // Check if the project is Archived
  if (project.status === "Archived") {
    throw new AppError(
      errors.ARCHIVED_PROJECT.message,
      errors.ARCHIVED_PROJECT.code,
      errors.ARCHIVED_PROJECT.errorCode,
      errors.ARCHIVED_PROJECT.suggestion
    );
  }

  // Update the team name + Save the changes
  if (newName && !isEmpty(newName) && newName !== team.name) {
    team.name = newName;
  }
  await team.save();

  return {
    status: "Success",
    code: 200,
    message: "Team name updated successfully!",
    data: team,
  };
};
