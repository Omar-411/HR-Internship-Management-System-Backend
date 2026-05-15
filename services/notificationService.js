import Notification from "../models/Notification.js";
import AppError from "../utils/AppError.js";
import { errors } from "../errors/notificationErrors.js";
import { getAll } from "./handlersFactory.js";
import { emitUnreadNotificationCount } from "../utils/notificationSocket.js";
import { getIO } from "../socket.js";

// Mark a notification as read
export const markNotificationAsRead = async (notificationId, currentUser) => {
  // Check notification existence
  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw new AppError(
      errors.NOTIFICATION_NOT_FOUND.message,
      errors.NOTIFICATION_NOT_FOUND.code,
      errors.NOTIFICATION_NOT_FOUND.errorCode,
      errors.NOTIFICATION_NOT_FOUND.suggestion,
    );
  }

  // ACCESS CONTROL: Only the recipient can mark it as read
  if (notification.recipientId.toString() !== currentUser.id.toString()) {
    throw new AppError(
      errors.FORBIDDEN_ACTION.message,
      errors.FORBIDDEN_ACTION.code,
      errors.FORBIDDEN_ACTION.errorCode,
      "You can only mark your own notifications as read.",
    );
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();

    await notification.save();
    await emitUnreadNotificationCount(notification.recipientId);
  }

  return {
    status: "Success",
    code: 200,
    message: "Notification marked as read successfully!",
    data: notification,
  };
};

// Mark all notifications of the current user as read
export const markAllNotificationsAsRead = async (currentUser) => {
  const now = new Date();

  const result = await Notification.updateMany(
    {
      recipientId: currentUser.id,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: now,
      },
    },
  );

  await emitUnreadNotificationCount(currentUser.id);

  return {
    status: "Success",
    code: 200,
    message: "All notifications marked as read successfully!",
    data: {
      modifiedCount: result.modifiedCount,
    },
  };
};

// Delete a single notification.
export const deleteNotification = async (notificationId, currentUser) => {
  // Check notification existence
  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw new AppError(
      errors.NOTIFICATION_NOT_FOUND.message,
      errors.NOTIFICATION_NOT_FOUND.code,
      errors.NOTIFICATION_NOT_FOUND.errorCode,
      errors.NOTIFICATION_NOT_FOUND.suggestion,
    );
  }

  // ACCESS CONTROL: Only the recipient can delete it
  if (notification.recipientId.toString() !== currentUser.id.toString()) {
    throw new AppError(
      errors.FORBIDDEN_ACTION.message,
      errors.FORBIDDEN_ACTION.code,
      errors.FORBIDDEN_ACTION.errorCode,
      "You can only delete your own notifications.",
    );
  }

  await Notification.findByIdAndDelete(notificationId);

  await emitUnreadNotificationCount(notification.recipientId);

  return {
    status: "Success",
    code: 200,
    message: "Notification deleted successfully!",
  };
};

// Get all notifications of the current user
export const getAllNotifications = async (currentUser, queryParams) => {
  const filter = {
    ...queryParams,
    recipientId: currentUser.id,
  };

  return await getAll(Notification, [
    { path: "recipientId", select: "name lastName email" },
  ])(filter);
};

// Get the 3 most recent notifications of the current user
export const getRecentNotifications = async (currentUser) => {
  const notifications = await Notification.find({
    recipientId: currentUser.id,
  })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate("recipientId", "name lastName email");

  return {
    status: "Success",
    code: 200,
    message: "3 Recent notifications retrieved successfully!",
    data: notifications,
  };
};

// Get unread notification count for the current user (Fallback function for the unread notification count)
export const getUnreadNotificationCount = async (currentUser) => {
  const count = await Notification.countDocuments({
    recipientId: currentUser.id,
    isRead: false,
  });

  return {
    status: "Success",
    code: 200,
    message: "Unread notification count retrieved successfully!",
    data: {
      unreadCount: count,
    },
  };
};

// Create a single notification and emit it in real time
export const createNotification = async ({
  recipientId,
  type,
  title,
  message,
  data = {},
}) => {
  // Create the notification
  const notification = await Notification.create({
    recipientId,
    type,
    title,
    message,
    data: {
      entityType: data.entityType || null,
      entityId: data.entityId || null,
    },
  });

  const io = getIO();

  // Emit the new notification in real time to the recipient
  if (io) {
    io.to(recipientId.toString()).emit("notification:new", notification);
  }

  // Update the unread notification count in real time
  await emitUnreadNotificationCount(recipientId);

  return notification;
};
