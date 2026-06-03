import {
    createMeeting,
    updateMeeting,
    respondToMeeting,
    cancelMeeting,
    getAllMeetingsOfProject,
    getMeetingById,
} from "../controllers/meetingController.js";
import express from "express";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Get all meetings by project
router.get(
  "/projects/:projectId/meetings",
  authenticate,
  getAllMeetingsOfProject
);

// Get a meeting by Id
router.get(
  "/meeting/:meetingId",
  authenticate,
  getMeetingById
);

// Create a meeting
router.post("/meeting", authenticate, authorize(["Supervisor"]), createMeeting);

// Update a meeting
router.patch("/meeting/:meetingId", authenticate, authorize(["Supervisor"]), updateMeeting);

// Cancel a meeting
router.patch("/meeting/:meetingId/cancel", authenticate, authorize(["Supervisor"]), cancelMeeting);

// Respond to a meeting invitation
router.patch("/meeting/:meetingId/respond", authenticate, respondToMeeting);

export default router;
