import * as teamService from "../services/teamService.js";

// Get team by ID
export const getTeamById = async (req, res, next) => {
  try {
    const result = await teamService.getTeamById(req.params.id, req.user);
    
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Update the team name
export const updateTeam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    const result = await teamService.updateTeamName(id, name, userId);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
