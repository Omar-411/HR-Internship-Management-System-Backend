// Team + Team Member related errors
export const errors = {
  UNAUTHORIZED_TO_ACCESS_TEAM: {
    message: "You are not authorized to access the team details.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_ACCESS_TEAM",
    suggestion:
      "Only the Admin, the Product Owner, and the team members can access the team details.",
  },
  UNAUTHORIZED_TO_UPDATE_TEAM: {
    message: "You are not authorized to update the team name.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_UPDATE_TEAM",
    suggestion: "Only the Product Owner of the project can update the team name.",
  },
  TEAM_MEMBER_NOT_AUTHORIZED: {
    message: "The user cannot be added as a team member.",
    code: 403,
    errorCode: "TEAM_MEMBER_NOT_AUTHORIZED",
    suggestion: "The user must be supervised by the same Product Owner and among the project team members to add it.",
  },
  UNAUTHORIZED_TO_ADD_TEAM_MEMBER: {
    message: "You are not authorized to add team members.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_ADD_TEAM_MEMBER",
    suggestion: "Only the Product Owner of the project can add team members to the team.",
  },
  UNAUTHORIZED_TO_REMOVE_TEAM_MEMBER: {
    message: "You are not authorized to remove the team member.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_REMOVE_TEAM_MEMBER",
    suggestion: "Only the Product Owner of the project can remove team members from the team.",
  },
  TEAM_MEMBER_WITH_ACTIVE_TASKS: {
    message: "The team member has active tasks and cannot be removed.",
    code: 400,
    errorCode: "TEAM_MEMBER_WITH_ACTIVE_TASKS",
    suggestion: "Please reassign the team member's active tasks to other team members before removing them from the team.",
  },
  UNAUTHORIZED_TO_UPDATE_TEAM_MEMBER: {
    message: "You are not authorized to update the team member.",  
    code: 403,
    errorCode: "UNAUTHORIZED_TO_UPDATE_TEAM_MEMBER",
    suggestion: "Only the Product Owner of the project can update a team member.",
  },
  INVALID_ROLE: {
    message: "Invalid team member role.",
    code: 400,
    errorCode: "INVALID_ROLE",
    suggestion: "Please choose a valid role for the team member.",
  },
  UNAUTHORIZED_TO_REPLACE_TEAM_MEMBER: {
    message: "You are not authorized to replace the team member.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_REPLACE_TEAM_MEMBER",
    suggestion: "Only the Product Owner of the project can replace team members in the team.",
  },
  TEAM_MEMBER_ALREADY_EXISTS: {
    message: "The user is already a member of the team.",
    code: 400,
    errorCode: "TEAM_MEMBER_ALREADY_EXISTS",
    suggestion: "The user is already a member of the team.",
  },
};
