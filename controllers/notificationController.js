import * as notificationService from "../services/notificationService.js";

// Mark a single notification as read
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const currentUser = req.user;

    const result = await notificationService.markNotificationAsRead(
      notificationId,
      currentUser,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Mark all notifications of the current user as read
export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const currentUser = req.user;
    const result =
      await notificationService.markAllNotificationsAsRead(currentUser);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Delete a single notification
export const deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const currentUser = req.user;

    const result = await notificationService.deleteNotification(
      notificationId,
      currentUser,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all notifications of the current user
export const getAllNotifications = async (req, res, next) => {
  try {
    const currentUser = req.user;
    const queryParams = req.query;

    const result = await notificationService.getAllNotifications(
      currentUser,
      queryParams,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get the 3 recent notifications of the current user
export const getRecentNotifications = async (req, res, next) => {
  try {
    const currentUser = req.user;
    const result =
      await notificationService.getRecentNotifications(currentUser);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get unread notification count for the current user
export const getUnreadNotificationCount = async (req, res, next) => {
  try {
    const currentUser = req.user;
    const result =
      await notificationService.getUnreadNotificationCount(currentUser);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
