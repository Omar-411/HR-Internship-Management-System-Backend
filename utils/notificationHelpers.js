import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import { createNotification } from "../services/notificationService.js";

// Retrieve all the active admin users for the blocked account notification 
export const getAdminUsers = async () => {
  // Find the Admin role document
  const adminRole = await UserRole.findOne({ name: "Admin" });

  if (!adminRole) {
    return [];
  }

  // Find all active users with the Admin role
  const admins = await User.find({
    role_id: adminRole._id,
    status: "Active",
  });

  return admins;
};

// Create a notification for all admin users when an employee account is blocked
export const createNotificationForAdmins = async ({
  type,
  title,
  message,
  data = {},
}) => {
  const admins = await getAdminUsers();

  for (const admin of admins) {
    await createNotification({
      recipientId: admin._id,
      type,
      title,
      message,
      data,
    });
  }
};

// Notify all active admins except the user who performed the action
export const createNotificationForAdminsExcept = async ({
  excludedUserId,
  type,
  title,
  message,
  data = {},
}) => {
  const admins = await getAdminUsers();

  const filteredAdmins = admins.filter(
    (admin) =>
      admin._id.toString() !== excludedUserId?.toString()
  );

  for (const admin of filteredAdmins) {
    await createNotification({
      recipientId: admin._id,
      type,
      title,
      message,
      data,
    });
  }
};
