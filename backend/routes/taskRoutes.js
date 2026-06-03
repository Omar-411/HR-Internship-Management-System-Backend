import express from "express";
import {
  getAllTaskStatuses,
  getAllTaskPriorities,
  getAllTaskTypes,
  getProjectTasks,
  getTaskById,
  addTask,
  updateTask,
  deleteTask,
  moveTask,
  submitTask,
  assignTask,
  getMyTasks,
  reviewTask,
  getTaskSubmission,
} from "../controllers/taskController.js";
import { upload } from "../middleware/upload.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Route to get all task statuses
router.get("/task-statuses", authenticate, getAllTaskStatuses);

// Route to get all task priorities
router.get("/task-priorities", authenticate, getAllTaskPriorities);

// Route to get all task types
router.get("/task-types", authenticate, getAllTaskTypes);

// Route to get all tasks for a specific project
router.get("/projects/:projectId/tasks", authenticate, getProjectTasks);

// Route to get a task by Id
router.get("/tasks/:taskId", authenticate, getTaskById);

// Route to add a new task to a project (supervisor only)
router.post(
  "/projects/:id/tasks",
  authenticate,
  authorize(["Supervisor"]),
  addTask,
);

// Route to update a task (supervisor only)
router.patch(
  "/tasks/:taskId",
  authenticate,
  authorize(["Supervisor"]),
  updateTask,
);

// Route to delete a task (supervisor only)
router.delete(
  "/tasks/:taskId",
  authenticate,
  authorize(["Supervisor"]),
  deleteTask,
);

// Route to move a task to a different status (Kanban logic)
router.patch(
  "/tasks/:taskId/move",
  authenticate,
  authorize(["Supervisor", "Employee", "Intern"]),
  moveTask,
);

// Route to submit a task
router.patch(
  "/tasks/:taskId/submit",
  authenticate,
  upload("doc").single("taskSubmission"),
  submitTask,
);

// Route to consult the task submission
router.get("/tasks/:taskId/submission", authenticate, getTaskSubmission);

// Route to assign a task
router.patch("/tasks/:taskId/assign", authenticate, assignTask);

// Route to get tasks assigned to the logged-in user
router.get("/my-tasks", authenticate, getMyTasks);

// Route to review a submitted task (supervisor only)
router.patch(
  "/tasks/:taskId/review",
  authenticate,
  authorize(["Supervisor"]),
  reviewTask,
);

export default router;
