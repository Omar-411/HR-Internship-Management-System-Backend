import {
    getTeamRoles,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    getProjectTeamMembers,
    getSupervisorTeamMembers,
} from "../controllers/teamMemberController.js";
import express from "express";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Route to get all possible team roles
router.get("/team-roles", authenticate, getTeamRoles);

// Route to get team members (Supervisor/admin only)
router.get(
  "/team-members/supervisor/:id",  
  authenticate,
  authorize(["Admin", "Supervisor"]),
  getSupervisorTeamMembers
);

// Route to get all team members of a project
router.get("/team-members/:teamId", authenticate, getProjectTeamMembers);

// Route to add a new team member to the team
router.post("/team-members/:teamId", authenticate, authorize(["Supervisor"]), addTeamMember);

// Route to update a team member's role
router.patch("/team-members/:teamMemberId", authenticate, authorize(["Supervisor"]), updateTeamMember);

// Route to remove a team member from the team
router.delete("/team-members/:teamMemberId", authenticate, authorize(["Supervisor"]), removeTeamMember);

export default router;
