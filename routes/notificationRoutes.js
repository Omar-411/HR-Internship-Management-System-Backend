import express from "express";
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getAllNotifications,
  getUnreadNotificationCount,
  getRecentNotifications,
} from "../controllers/notificationController.js";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

// Mark a single notification as read
router.patch(
  "/notifications/:notificationId/read",
  authenticate,
  markNotificationAsRead,
);

// Mark all notifications of the current user as read
router.patch(
  "/notifications/read-all",
  authenticate,
  markAllNotificationsAsRead,
);

// Get the 3 recent notifications
router.get("/notifications/recent", authenticate, getRecentNotifications);

// Delete a single notification
router.delete(
  "/notifications/:notificationId",
  authenticate,
  deleteNotification,
);

// Get all notifications of the current user
router.get("/notifications", authenticate, getAllNotifications);

// Get unread notification count for the current user
router.get(
  "/notifications/unread-count",
  authenticate,
  getUnreadNotificationCount,
);

export default router;
