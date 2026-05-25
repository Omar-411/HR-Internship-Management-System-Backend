import * as teamMemberService from "../services/teamMemberService.js";

// Get all possible team roles (Except "Scrum Master")
export const getTeamRoles = async (req, res, next) => {
  try {
    const result = await teamMemberService.getTeamRoles();
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all team members of a team
export const getProjectTeamMembers = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const result = await teamMemberService.getProjectTeamMembers(
      req.query, 
      teamId, 
      req.user
    );
    
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get the team members under a supervisor (Active and Available))
export const getSupervisorTeamMembers = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await teamMemberService.getSupervisorTeamMembers(
      id,
      req.user,
      req.query
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Add a new team member to the team
export const addTeamMember = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { userId, role } = req.body;

    const result = await teamMemberService.addTeamMember(
      teamId,
      userId,
      role,
      req.user
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Update Team Member Role
export const updateTeamMember = async (req, res, next) => {
  try {
    const { teamMemberId } = req.params;
    const { role, isActive } = req.body;

    const result = await teamMemberService.updateTeamMember(
      teamMemberId,
      { role, isActive },
      req.user
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Remove a team member from the team
export const removeTeamMember = async (req, res, next) => {
  try {
    const { teamMemberId } = req.params;

    const result = await teamMemberService.removeTeamMember(
      teamMemberId,
      req.user
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
