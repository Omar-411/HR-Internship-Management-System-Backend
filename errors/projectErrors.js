export const errors = {
  PROJECT_NOT_FOUND: {
    message: "Project not found",
    code: 404,
    errorCode: "PROJECT_NOT_FOUND",
    suggestion: "Please provide a valid project ID.",
  },
  TEAM_NOT_FOUND: {
    message: "Team not found for this project",
    code: 404,
    errorCode: "TEAM_NOT_FOUND",
    suggestion: "Ensure the project has a team.",
  },
  MISSING_REQUIRED_FIELDS: {
    message: "Missing required fields",
    code: 400,
    errorCode: "PROJECT_MISSING_FIELDS",
    suggestion: "Please provide all required fields.",
  },
  INVALID_SECTOR: {
    message: "Invalid project sector",
    code: 400,
    errorCode: "PROJECT_INVALID_SECTOR",
    suggestion: "Select a valid sector value.",
  },
  INVALID_REQUIREMENTS: {
    message: "Invalid project requirements",
    code: 400,
    errorCode: "PROJECT_INVALID_REQUIREMENTS",
    suggestion: "Required technologies and needed roles must be lists of text values.",
  },
  INVALID_STATUS: {
    message: "Invalid project status",
    code: 400,
    errorCode: "PROJECT_INVALID_STATUS",
    suggestion: "Select a valid project status.",
  },
  INVALID_AI_EVALUATION_STATUS: {
    message: "Invalid AI evaluation status",
    code: 400,
    errorCode: "PROJECT_INVALID_AI_EVALUATION_STATUS",
    suggestion: "Use one of these values: Pending, Generated, Failed.",
  },
  INVALID_DUE_DATE: {
    message: "Invalid due date",
    code: 400,
    errorCode: "PROJECT_INVALID_DUE_DATE",
    suggestion: "Due date must be after the start date.",
  },
  INVALID_SCRUM_MASTER: {
    message: "Invalid scrum master selection",
    code: 400,
    errorCode: "PROJECT_INVALID_SCRUM_MASTER",
    suggestion:
      "Scrum master must be a valid team member, cannot be an intern and appear once in the team list.",
  },
  DUPLICATE_USERS: {
    message: "Duplicate team members detected",
    code: 400,
    errorCode: "PROJECT_DUPLICATE_USERS",
    suggestion: "Please, remove duplicate users from the team list.",
  },
  PROJECT_FORBIDDEN_ACTION: {
    message: "You are not allowed to perform this action on this project",
    code: 403,
    errorCode: "PROJECT_FORBIDDEN_ACTION",
    suggestion: "Only authorized members can perform this operation.",
  },
  UNAUTHORIZED_TO_ACCESS_PROJECT: {
    message: "Unauthorized access to project",
    code: 403,
    errorCode: "PROJECT_UNAUTHORIZED_ACCESS",
    suggestion: "You do not have permission to access this project.",
  },
  UNAUTHORIZED_TO_ADD_TEAM_MEMBER: {
    message: "Unauthorized to add team members",
    code: 403,
    errorCode: "PROJECT_UNAUTHORIZED_TEAM_ADD",
    suggestion: "Only the product owner can manage team members.",
  },
  UNAUTHORIZED_TO_ASSIGN_SCRUM_MASTER: {
    message: "Unauthorized to assign scrum master",
    code: 403,
    errorCode: "PROJECT_UNAUTHORIZED_SCRUM_MASTER",
    suggestion: "Scrum master must belong to the same project team.",
  },
  PROJECT_STATE_LOCKED: {
    message: "Project is locked due to its current state",
    code: 423, // 423 = Locked ressource
    errorCode: "PROJECT_LOCKED",
    suggestion: "Change project status to allow further modifications.",
  },
  PROJECT_EXISTS: {
    message: "This project already exists",
    code: 409,
    errorCode: "PROJECT_EXISTS",
    suggestion: "Please provide a different project name.",
  },
  ARCHIVED_PROJECT: {
    message: "Cannot modify an archived project",
    code: 400,
    errorCode: "PROJECT_ARCHIVED",
    suggestion: "Restore the project before performing this action.",
  },
  ON_HOLD_PROJECT: {
    message: "Cannot modify a project that is on hold",
    code: 409, // 409 = Conflict
    errorCode: "PROJECT_ON_HOLD",
    suggestion: "Resume the project before continuing.",
  },
  COMPLETED_PROJECT: {
    message: "Cannot modify a completed project",
    code: 409,
    errorCode: "PROJECT_COMPLETED",
    suggestion: "Reopen the project if changes are required.",
  },
  PROJECT_ALREADY_ARCHIVED: {
    message: "Project is already archived",
    code: 409,
    errorCode: "PROJECT_ALREADY_ARCHIVED",
    suggestion: "No action needed.",
  },
  INVALID_RESTORE_STATE: {
    message: "Only archived projects can be restored",
    code: 400,
    errorCode: "PROJECT_INVALID_RESTORE_STATE",
    suggestion: "Archive the project before restoring it.",
  },
  SCRUM_MASTER_REQUIRED: {
    message: "Scrum master is required to activate the project",
    code: 400,
    errorCode: "PROJECT_SCRUM_MASTER_REQUIRED",
    suggestion: "Assign a scrum master before activating the project.",
  },
  TEAM_MEMBERS_REQUIRED: {
    message: "At least one team member is required",
    code: 400,
    errorCode: "PROJECT_TEAM_REQUIRED",
    suggestion: "Add team members before activating the project.",
  },
};
