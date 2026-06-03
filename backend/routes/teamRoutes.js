import {
    getTeamById,
    updateTeam,
} from "../controllers/teamController.js";
import express from "express";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Route to get team by ID (Authenticated users only)
router.get("/team/:id", authenticate, getTeamById);

// Route to update team name (Supervisor only)
router.put("/team/:id", authenticate, authorize(["Supervisor"]), updateTeam);

export default router;
