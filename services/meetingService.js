import mongoose from "mongoose";
import Meeting from "../models/Meeting.js";
import Project from "../models/Project.js";
import Team from "../models/Team.js";
import TeamMember from "../models/TeamMember.js";
import AppError from "../utils/AppError.js";
import { errors } from "../errors/meetingErrors.js";
import { errors as projectErrors } from "../errors/projectErrors.js";
import { getOne, getAll } from "./handlersFactory.js";
import { resolveId } from "../utils/idResolver.js";
import { notifyMeetingAttendees } from "../utils/notificationHelpers.js";
import { createNotification } from "./notificationService.js";

// Get all meetings by project
export const getAllMeetingsOfProject = async (
  projectId,
  currentUser,
  queryParams,
) => {
  // Check project existence
  const projectMatch = resolveId(projectId);
  const project = await Project.findOne(projectMatch);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Build the base filter
  let filter = { projectId: project._id };

  // If NOT the Product Owner, restrict displaying the meetings to the attendees only
  if (project.productOwnerId?.toString() !== currentUser.id) {
    filter["attendees.userId"] = currentUser.id;
  }

  // Build the query parameters
  const enhancedQueryParams = {
    ...queryParams,
    ...filter,
  };

  return await getAll(
    Meeting,
    [
      { path: "projectId", select: "name" },
      { path: "attendees.userId", select: "name email" },
    ],
    null,
    ["title", "description"],
  )(enhancedQueryParams);
};

// Get a meeting by Id
export const getMeetingById = async (meetingId, currentUser) => {
  // Check the meeting existence
  const meetingMatch = resolveId(meetingId);
  const meeting = await Meeting.findOne(meetingMatch);
  if (!meeting) {
    throw new AppError(
      errors.MEETING_NOT_FOUND.message,
      errors.MEETING_NOT_FOUND.code,
      errors.MEETING_NOT_FOUND.errorCode,
      errors.MEETING_NOT_FOUND.suggestion,
    );
  }

  // Check the project existence
  const project = await Project.findById(meeting.projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Check if the user is the Product Owner or an attendee of the meeting
  const isProductOwner = project.productOwnerId?.toString() === currentUser.id;

  const isAttendee = meeting.attendees.some(
    (att) => att.userId?.toString() === currentUser.id,
  );

  // Authorization check
  if (!isProductOwner && !isAttendee) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_ACCESS_MEETING.message,
      errors.UNAUTHORIZED_TO_ACCESS_MEETING.code,
      errors.UNAUTHORIZED_TO_ACCESS_MEETING.errorCode,
      errors.UNAUTHORIZED_TO_ACCESS_MEETING.suggestion,
    );
  }

  return await getOne(Meeting, errors.MEETING_NOT_FOUND, [
    { path: "projectId", select: "name" },
    { path: "attendees.userId", select: "name email" },
  ])(meeting._id);
};

// Plan a new meeting (Product owner only)
export const createMeeting = async (data, currentUser) => {
  const {
    title,
    description,
    projectId,
    date,
    startTime,
    endTime,
    locationType,
    meetingLink,
    address,
    priority,
    reminder,
    attendees,
  } = data;

  // Check project existence
  const projectMatch = resolveId(projectId);
  const project = await Project.findOne(projectMatch);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Authorization check: Only Product Owner can create project meetings
  if (project.productOwnerId?.toString() !== currentUser.id.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_CREATE_MEETING.message,
      errors.UNAUTHORIZED_TO_CREATE_MEETING.code,
      errors.UNAUTHORIZED_TO_CREATE_MEETING.errorCode,
      errors.UNAUTHORIZED_TO_CREATE_MEETING.suggestion,
    );
  }

  // Validate the meeting time
  if (endTime <= startTime) {
    throw new AppError(
      errors.INVALID_TIME_RANGE.message,
      errors.INVALID_TIME_RANGE.code,
      errors.INVALID_TIME_RANGE.errorCode,
      errors.INVALID_TIME_RANGE.suggestion,
    );
  }

  // Validate the reminder time
  const allowedReminders = Meeting.schema.path(
    "reminderMinutesBefore",
  ).enumValues;
  if (reminder && !allowedReminders.includes(reminder)) {
    throw new AppError(
      errors.INVALID_REMINDER.message,
      errors.INVALID_REMINDER.code,
      errors.INVALID_REMINDER.errorCode,
      errors.INVALID_REMINDER.suggestion,
    );
  }

  // Validate the meeting location
  if (locationType === "Online" && !meetingLink) {
    throw new AppError(
      errors.MEETING_LINK_REQUIRED.message,
      errors.MEETING_LINK_REQUIRED.code,
      errors.MEETING_LINK_REQUIRED.errorCode,
      errors.MEETING_LINK_REQUIRED.suggestion,
    );
  }

  if (locationType === "Physical" && !address) {
    throw new AppError(
      errors.MEETING_ADDRESS_REQUIRED.message,
      errors.MEETING_ADDRESS_REQUIRED.code,
      errors.MEETING_ADDRESS_REQUIRED.errorCode,
      errors.MEETING_ADDRESS_REQUIRED.suggestion,
    );
  }

  // Check the team existence
  const team = await Team.findOne({ projectId: project._id });
  if (!team) {
    throw new AppError(
      projectErrors.TEAM_NOT_FOUND.message,
      projectErrors.TEAM_NOT_FOUND.code,
      projectErrors.TEAM_NOT_FOUND.errorCode,
      projectErrors.TEAM_NOT_FOUND.suggestion,
    );
  }

  // Get valid team members
  const teamMembers = await TeamMember.find({ teamId: team._id }).select(
    "userId",
  );

  const validUserIds = teamMembers.map((m) => m.userId?.toString());

  // Validate the attendees
  const invalidAttendees = attendees.filter(
    (userId) => !validUserIds.includes(userId),
  );

  if (invalidAttendees.length > 0) {
    throw new AppError(
      errors.INVALID_ATTENDEES.message,
      errors.INVALID_ATTENDEES.code,
      errors.INVALID_ATTENDEES.errorCode,
      errors.INVALID_ATTENDEES.suggestion,
    );
  }

  // Remove the user duplicates (if any)
  const uniqueAttendees = [...new Set(attendees)];

  // Add the meeting creator (product owner) to the attendees list if not already included
  if (!uniqueAttendees.includes(currentUser.id)) {
    uniqueAttendees.push(currentUser.id);
  }

  // Create meeting
  const meeting = await Meeting.create({
    title,
    description,
    projectId: project._id,
    date,
    startTime,
    endTime,
    locationType,
    meetingLink: locationType === "Online" ? meetingLink : null,
    address: locationType === "Physical" ? address : null,
    priority,
    reminderMinutesBefore: reminder,
    // The product owner automatically accepts the meeting invitation
    attendees: uniqueAttendees.map((userId) => ({
      userId,
      status: userId === currentUser.id.toString() ? "Accepted" : "Pending", 
      respondedAt: userId === currentUser.id.toString() ? new Date() : null,
      responseReason: null,
    })),
    createdBy: currentUser.id,
  });

  // Notify all attendees except the product owner (who created the meeting)
  try {
    await notifyMeetingAttendees({
      meeting,
      project,
      title: "New meeting scheduled",
      message: `A new meeting "${meeting.title}" has been scheduled for project "${project.name}".`,
    });
  } catch (err) {
    console.error("Failed to send meeting creation notifications:", err);
  }

  return {
    status: "Success",
    code: 201,
    message: "Meeting Created successfully!",
    data: meeting,
  };
};

// update a meeting (Product owner only)
export const updateMeeting = async (meetingId, data, currentUser) => {
  // Check the meeting existence
  const meetingMatch = resolveId(meetingId);
  const meeting = await Meeting.findOne(meetingMatch);
  if (!meeting) {
    throw new AppError(
      errors.MEETING_NOT_FOUND.message,
      errors.MEETING_NOT_FOUND.code,
      errors.MEETING_NOT_FOUND.errorCode,
      errors.MEETING_NOT_FOUND.suggestion,
    );
  }

  // Check the project existence
  const project = await Project.findById(meeting.projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Authorization check: Only Product Owner can update project meetings
  if (project.productOwnerId?.toString() !== currentUser.id.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_UPDATE_MEETING.message,
      errors.UNAUTHORIZED_TO_UPDATE_MEETING.code,
      errors.UNAUTHORIZED_TO_UPDATE_MEETING.errorCode,
      errors.UNAUTHORIZED_TO_UPDATE_MEETING.suggestion,
    );
  }

  // Prevent updating past meetings
  const now = new Date();
  const meetingStart = new Date(meeting.date);

  const [hours, minutes] = meeting.startTime.split(":");
  meetingStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  // Prevent updating if meeting already started
  if (meetingStart <= now) {
    throw new AppError(
      errors.PAST_MEETING_UPDATE.message,
      errors.PAST_MEETING_UPDATE.code,
      errors.PAST_MEETING_UPDATE.errorCode,
      errors.PAST_MEETING_UPDATE.suggestion,
    );
  }

  const {
    title,
    description,
    date,
    startTime,
    endTime,
    locationType,
    meetingLink,
    address,
    priority,
    reminder,
    attendees,
  } = data;

  // Time validation
  const newStart = startTime || meeting.startTime;
  const newEnd = endTime || meeting.endTime;

  if (newEnd <= newStart) {
    throw new AppError(
      errors.INVALID_TIME_RANGE.message,
      errors.INVALID_TIME_RANGE.code,
      errors.INVALID_TIME_RANGE.errorCode,
      errors.INVALID_TIME_RANGE.suggestion,
    );
  }

  // Location validation
  const finalLocationType = locationType || meeting.locationType;

  if (finalLocationType === "Online") {
    if (!meetingLink && !meeting.meetingLink) {
      throw new AppError(
        errors.MEETING_LINK_REQUIRED.message,
        errors.MEETING_LINK_REQUIRED.code,
        errors.MEETING_LINK_REQUIRED.errorCode,
        errors.MEETING_LINK_REQUIRED.suggestion,
      );
    }
    meeting.meetingLink = meetingLink || meeting.meetingLink;
    meeting.address = null;
  }

  if (finalLocationType === "Physical") {
    if (!address && !meeting.address) {
      throw new AppError(
        errors.MEETING_ADDRESS_REQUIRED.message,
        errors.MEETING_ADDRESS_REQUIRED.code,
        errors.MEETING_ADDRESS_REQUIRED.errorCode,
        errors.MEETING_ADDRESS_REQUIRED.suggestion,
      );
    }
    meeting.address = address || meeting.address;
    meeting.meetingLink = null;
  }

  // Store the original attendee IDs before any modifications
  const previousAttendeeIds = meeting.attendees.map((att) =>
    att.userId.toString(),
  );

  // Attendees validation
  if (attendees) {
    // Get the project team
    const team = await Team.findOne({ projectId: meeting.projectId });
    if (!team) {
      throw new AppError(
        projectErrors.TEAM_NOT_FOUND.message,
        projectErrors.TEAM_NOT_FOUND.code,
        projectErrors.TEAM_NOT_FOUND.errorCode,
        projectErrors.TEAM_NOT_FOUND.suggestion,
      );
    }

    // Get the project team members
    const teamMembers = await TeamMember.find({ teamId: team._id }).select(
      "userId",
    );
    const validUserIds = new Set(teamMembers.map((m) => m.userId?.toString()));

    // Validate the attendees
    for (const userId of attendees) {
      if (!validUserIds.has(userId)) {
        throw new AppError(
          errors.INVALID_ATTENDEES.message,
          errors.INVALID_ATTENDEES.code,
          errors.INVALID_ATTENDEES.errorCode,
          errors.INVALID_ATTENDEES.suggestion,
        );
      }
    }

    // Remove duplicates
    const newSet = new Set(attendees.map((id) => id.toString()));

    // Map the existing attendees
    const existingMap = new Map();
    meeting.attendees.forEach((att) => {
      existingMap.set(att.userId.toString(), att);
    });

    const updatedAttendees = [];

    // Keep existing attendees and preserve their status
    for (const userId of newSet) {
      if (existingMap.has(userId)) {
        updatedAttendees.push(existingMap.get(userId));
      } else {
        updatedAttendees.push({
          userId,
          status: "Pending",
          reason: null,
          respondedAt: null,
        });
      }
    }

    // Add the meeting creator (product owner) to the attendees list if not already included
    const attendeeUserIds = updatedAttendees.map((a) => a.userId?.toString());
    if (!attendeeUserIds.includes(currentUser.id.toString())) {
      updatedAttendees.push({
        userId: currentUser.id,
        status: "Pending",
        reason: null,
        respondedAt: null,
      });
    }

    // Assign the final list
    meeting.attendees = updatedAttendees;
  }

  // Apply updates
  if (title) meeting.title = title;
  if (description !== undefined) meeting.description = description;
  if (date) meeting.date = date;
  if (startTime) meeting.startTime = startTime;
  if (endTime) meeting.endTime = endTime;
  if (locationType) meeting.locationType = locationType;
  if (priority) meeting.priority = priority;
  if (reminder) meeting.reminder = reminder;

  await meeting.save();

  // Notify attendees about meeting updates and attendee changes
  try {
    if (attendees) {
      const currentAttendeeIds = meeting.attendees.map((att) =>
        att.userId.toString(),
      );

      // Get the newly added attendees
      const addedAttendees = currentAttendeeIds.filter(
        (id) => !previousAttendeeIds.includes(id),
      );

      // Get the removed attendees
      const removedAttendees = previousAttendeeIds.filter(
        (id) => !currentAttendeeIds.includes(id),
      );

      // Exclude the users who should NOT receive the generic "Meeting updated" notification
      const excludedUserIds = [
        ...new Set([...addedAttendees, ...removedAttendees]),
      ];

      // Notify existing attendees only (Pending or Accepted),
      await notifyMeetingAttendees({
        meeting,
        project,
        title: "Meeting updated",
        message: `The meeting "${meeting.title}" in project "${project.name}" has been updated.`,
        excludedUserIds,
      });

      // Notify the newly added attendees
      for (const userId of addedAttendees) {
        if (userId === currentUser.id.toString()) continue;

        await createNotification({
          recipientId: userId,
          type: "MEETING",
          title: "Added to meeting",
          message: `You have been added to the meeting "${meeting.title}" in project "${project.name}".`,
          data: {
            entityType: "MEETING",
            entityId: meeting._id,
          },
        });
      }

      // Notify the removed attendees
      for (const userId of removedAttendees) {
        if (userId === currentUser.id.toString()) continue;

        await createNotification({
          recipientId: userId,
          type: "MEETING",
          title: "Removed from meeting",
          message: `You have been removed from the meeting "${meeting.title}" in project "${project.name}".`,
          data: {
            entityType: "MEETING",
            entityId: meeting._id,
          },
        });
      }
    } else {
      // If, No attendee list change: generic update meeting notification
      await notifyMeetingAttendees({
        meeting,
        project,
        title: "Meeting updated",
        message: `The meeting "${meeting.title}" in project "${project.name}" has been updated.`,
      });
    }
  } catch (err) {
    console.error("Failed to send meeting update notifications:", err);
  }

  return {
    status: "Success",
    code: 200,
    message: "Meeting updated successfully!",
    data: meeting,
  };
};

// Cancel a meeting
export const cancelMeeting = async (meetingId, currentUser) => {
  // Check meeting existence
  const meetingMatch = resolveId(meetingId);
  const meeting = await Meeting.findOne(meetingMatch);
  if (!meeting) {
    throw new AppError(
      errors.MEETING_NOT_FOUND.message,
      errors.MEETING_NOT_FOUND.code,
      errors.MEETING_NOT_FOUND.errorCode,
      errors.MEETING_NOT_FOUND.suggestion,
    );
  }

  // Get project
  const project = await Project.findById(meeting.projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Authorization check: Only Product Owner can cancel project meetings
  if (project.productOwnerId?.toString() !== currentUser.id.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_CANCEL_MEETING.message,
      errors.UNAUTHORIZED_TO_CANCEL_MEETING.code,
      errors.UNAUTHORIZED_TO_CANCEL_MEETING.errorCode,
      errors.UNAUTHORIZED_TO_CANCEL_MEETING.suggestion,
    );
  }

  // Prevent the double meeting cancel
  if (meeting.status === "Cancelled") {
    throw new AppError(
      errors.MEETING_ALREADY_CANCELLED.message,
      errors.MEETING_ALREADY_CANCELLED.code,
      errors.MEETING_ALREADY_CANCELLED.errorCode,
      errors.MEETING_ALREADY_CANCELLED.suggestion,
    );
  }

  // Prevent cancelling past meetings
  const now = new Date();
  const meetingStart = new Date(meeting.date);

  const [hours, minutes] = meeting.startTime.split(":");
  meetingStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  if (meetingStart <= now) {
    throw new AppError(
      errors.PAST_MEETING_CANCEL.message,
      errors.PAST_MEETING_CANCEL.code,
      errors.PAST_MEETING_CANCEL.errorCode,
      errors.PAST_MEETING_CANCEL.suggestion,
    );
  }

  // Cancel the meeting
  meeting.status = "Cancelled";
  await meeting.save();

  // Notify attendees who accepted or have not responded yet
  try {
    await notifyMeetingAttendees({
      meeting,
      project,
      title: "Meeting cancelled",
      message: `The meeting "${meeting.title}" in project "${project.name}" has been cancelled.`,
    });
  } catch (err) {
    console.error("Failed to send meeting cancellation notifications:", err);
  }

  return {
    status: "Success",
    code: 200,
    message: "Meeting cancelled successfully!",
    data: meeting,
  };
};

// Respond to a meeting (Attend or not attend a meeting)
export const respondToMeeting = async (
  meetingId,
  currentUser,
  status,
  reason,
) => {
  // Validate the status value
  const allowedStatuses = ["Accepted", "Rejected"];
  if (!allowedStatuses.includes(status)) {
    throw new AppError(
      errors.INVALID_RESPONSE_STATUS.message,
      errors.INVALID_RESPONSE_STATUS.code,
      errors.INVALID_RESPONSE_STATUS.errorCode,
      errors.INVALID_RESPONSE_STATUS.suggestion,
    );
  }

  // If the meeting invitation is rejected, the rejection reason is required
  if (status === "Rejected" && !reason) {
    throw new AppError(
      errors.REJECTION_REASON_REQUIRED.message,
      errors.REJECTION_REASON_REQUIRED.code,
      errors.REJECTION_REASON_REQUIRED.errorCode,
      errors.REJECTION_REASON_REQUIRED.suggestion,
    );
  }

  // Check the meeting existence + attendee existence
  const meetingMatch = resolveId(meetingId);
  const meeting = await Meeting.findOne({
    ...meetingMatch,
    "attendees.userId": currentUser.id,
  });
  if (!meeting) {
    throw new AppError(
      errors.MEETING_OR_ATTENDEE_NOT_FOUND.message,
      errors.MEETING_OR_ATTENDEE_NOT_FOUND.code,
      errors.MEETING_OR_ATTENDEE_NOT_FOUND.errorCode,
      errors.MEETING_OR_ATTENDEE_NOT_FOUND.suggestion,
    );
  }

  // Prevent responding to past meetings
  const now = new Date();
  const meetingStart = new Date(meeting.date);

  const [hours, minutes] = meeting.startTime.split(":");
  meetingStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  if (meetingStart <= now || meeting.status === "Cancelled") {
    throw new AppError(
      errors.PAST_MEETING_RESPONSE.message,
      errors.PAST_MEETING_RESPONSE.code,
      errors.PAST_MEETING_RESPONSE.errorCode,
      errors.PAST_MEETING_RESPONSE.suggestion,
    );
  }

  // Prevent the double response
  const attendee = meeting.attendees.find(
    (a) => a.userId?.toString() === currentUser.id.toString(),
  );
  if (attendee.status !== "Pending") {
    throw new AppError(
      errors.ALREADY_RESPONDED.message,
      errors.ALREADY_RESPONDED.code,
      errors.ALREADY_RESPONDED.errorCode,
      errors.ALREADY_RESPONDED.suggestion,
    );
  }

  // Update the attendee response
  const updatedMeeting = await Meeting.findOneAndUpdate(
    {
      ...meetingMatch,
      "attendees.userId": currentUser.id,
    },
    {
      $set: {
        "attendees.$.status": status,
        "attendees.$.responseReason": reason ? reason : null,
        "attendees.$.respondedAt": new Date(),
      },
    },
    { returnDocument: "after" },
  );

  // Get the project to retrieve its product owner
  const project = await Project.findById(updatedMeeting.projectId);

  if (project) {
    // Get the user details for notification
    const user = await TeamMember.findOne({
      teamId: project.team_id,
      userId: currentUser.id,
    }).populate("userId", "name lastName");

    if (user) {
      try {
        await createNotification({
          recipientId: project.productOwnerId,
          type: "MEETING",
          title: "Meeting response received",
          message:
            status === "Accepted"
              ? `${user.userId.name} ${user.userId.lastName} has accepted the invitation to "${updatedMeeting.title}".`
              : `${user.userId.name} ${user.userId.lastName} has declined the invitation to "${updatedMeeting.title}".`,
          data: {
            entityType: "MEETING",
            entityId: updatedMeeting._id,
          },
        });
      } catch (err) {
        console.error("Failed to send meeting response notification:", err);
      }
    }
  }

  return {
    status: "Success",
    code: 200,
    message: "Meeting invitation response submitted successfully!",
    data: updatedMeeting,
  };
};
