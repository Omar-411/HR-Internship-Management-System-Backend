import express from "express";
import {
    getAllSectors,
    getAllStatuses,
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    archiveProject,
    restoreProject,
    deleteProject,
    getProjectOverview,
    getProjectAiEvaluation,
    evaluateProjectCandidates,
} from "../controllers/projectController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Route to get all sectors
router.get("/project-sectors", authenticate, getAllSectors);

// Route to get all statuses
router.get("/project-statuses", authenticate, getAllStatuses);

// Route to get all projects with pagination (12 per page)
router.get("/projects", authenticate, getAllProjects);

// Route to get project overview (Stats about sprints, tasks, velocity, etc.)
router.get("/projects/:id/overview", authenticate, getProjectOverview);

// Route to evaluate and rank project candidates using the AI matching model
router.post("/projects/:id/ai-evaluation", authenticate, authorize(["Admin", "Supervisor"]), evaluateProjectCandidates);

// Route to get the saved project AI evaluation state/result
router.get("/projects/:id/ai-evaluation", authenticate, authorize(["Admin", "Supervisor"]), getProjectAiEvaluation);

// Route to get a specific project by ID
router.get("/projects/:id", authenticate, getProjectById);

// Route to create a new project (Supervisors only)
router.post("/projects", authenticate, authorize(["Supervisor"]), createProject);

// Route to update a project (Supervisors only)
router.patch("/projects/:id", authenticate, authorize(["Supervisor"]), updateProject);

// Route to archive a project (Supervisor only)
router.patch("/projects/:id/archive", authenticate, authorize(["Supervisor"]), archiveProject);

// Route to restore an archived project (Supervisor only)
router.patch("/projects/:id/restore", authenticate, authorize(["Supervisor"]), restoreProject);
    
// Route to delete a project (Admin only)
router.delete("/projects/:id", authenticate, authorize(["Admin"]), deleteProject);

export default router;
