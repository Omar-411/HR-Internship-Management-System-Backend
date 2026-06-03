import express from "express";
import {
    getProjectSprints,
    getSprintById,
    createSprint,
    updateSprint,
    deleteSprint,
    startSprint,
    completeSprint,
} from "../controllers/sprintController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router(); 

// Get all sprints of a project
router.get("/sprints/:projectId", authenticate, getProjectSprints);

// Get a sprint by Id
router.get("/sprint/:id", authenticate, getSprintById);

// Create a new sprint
router.post("/sprint/:projectId", authenticate, authorize(["Supervisor"]), createSprint);

// Update a sprint
router.patch("/sprint/:sprintId", authenticate, authorize(["Supervisor"]), updateSprint);

// Delete a sprint
router.delete("/sprint/:sprintId", authenticate, authorize(["Supervisor"]), deleteSprint);

// Start a sprint
router.patch("/sprint/:sprintId/start", authenticate, authorize(["Supervisor"]), startSprint);

// Complete a sprint
router.patch("/sprint/:sprintId/complete", authenticate, authorize(["Supervisor"]), completeSprint);

export default router;
