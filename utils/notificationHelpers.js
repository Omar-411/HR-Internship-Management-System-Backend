import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Project from "../models/Project.js";
import TeamMember from "../models/TeamMember.js";
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
    (admin) => admin._id.toString() !== excludedUserId?.toString(),
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

// Notify all active project members except specific users
export const notifyProjectMembers = async ({
  projectId,
  excludedUserIds = [],
  type = "PROJECT",
  title,
  message,
  data = {},
}) => {
  const project = await Project.findById(projectId);
  if (!project?.team_id) return;

  const members = await TeamMember.find({
    teamId: project.team_id,
    isActiveInProject: { $ne: false },
  });

  const excluded = excludedUserIds.map((id) => id.toString());

  const uniqueUserIds = [
    ...new Set(members.map((member) => member.userId.toString())),
  ];

  const recipients = uniqueUserIds.filter(
    (userId) => !excluded.includes(userId),
  );

  for (const recipientId of recipients) {
    await createNotification({
      recipientId,
      type,
      title,
      message,
      data,
    });
  }
};

// Notify all relevant stakeholders when a project is deleted
export const notifyProjectDeletion = async ({
  project,
  deletedByUserId,
  teamMemberIds = [],
}) => {
  const recipients = new Set();

  // Add the Product Owner
  if (project.productOwnerId) {
    recipients.add(project.productOwnerId.toString());
  }

  // Team Members
  for (const userId of teamMemberIds) {
    recipients.add(userId.toString());
  }

  // Remove the user who deleted the project
  recipients.delete(deletedByUserId.toString());

  // Notify stakeholders
  for (const recipientId of recipients) {
    await createNotification({
      recipientId,
      type: "PROJECT",
      title: "Project Deleted",
      message: `The project "${project.name}" has been deleted.`,
      data: {
        entityType: "PROJECT",
        entityId: project._id,
      },
    });
  }

  // Notify other admins
  await createNotificationForAdminsExcept({
    excludedUserId: deletedByUserId,
    type: "PROJECT",
    title: "Project Deleted",
    message: `The project "${project.name}" has been deleted.`,
    data: {
      entityType: "PROJECT",
      entityId: project._id,
    },
  });
};

// Notify attendees whose status is "Pending" or "Accepted" in the meeting
export const notifyMeetingAttendees = async ({
  meeting,
  project,
  title,
  message,
  excludedUserIds = [],
  excludeProductOwner = true,
}) => {
  // Get attendees eligible for notification
  const recipients = meeting.attendees
    .filter((attendee) => ["Pending", "Accepted"].includes(attendee.status))
    .map((attendee) => attendee.userId.toString());

  // Remove duplicates to avoid sending multiple notifications to the same user
  let finalRecipients = [...new Set(recipients)];

  // Exclude specific users if provided
  const excluded = excludedUserIds.map((id) => id.toString());
  finalRecipients = finalRecipients.filter(
    (userId) => !excluded.includes(userId),
  );

  // Exclude the product owner by default, unless specified otherwise
  if (excludeProductOwner) {
    const productOwnerId = project.productOwnerId.toString();
    finalRecipients = finalRecipients.filter(
      (userId) => userId !== productOwnerId,
    );
  }

  // Create notifications
  for (const recipientId of finalRecipients) {
    await createNotification({
      recipientId,
      type: "MEETING",
      title,
      message,
      data: {
        entityType: "MEETING",
        entityId: null,
      },
    });
  }
};
