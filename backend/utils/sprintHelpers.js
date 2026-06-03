import Project from "../models/Project.js";
import Sprint from "../models/Sprint.js";
import Meeting from "../models/Meeting.js";
import Team from "../models/Team.js";
import TeamMember from "../models/TeamMember.js";
import AppError from "./AppError.js";
import { errors as projectErrors } from "../errors/projectErrors.js";
import { errors as sprintErrors } from "../errors/sprintErrors.js";
import { notifyMeetingAttendees } from "./notificationHelpers.js";

// Check if a sprint or the project exists
export const checkSprintAndProjectExistence = async (sprintId) => {
  // Check the sprint existence
  const sprint = await Sprint.findById(sprintId);
  if (!sprint) {
    throw new AppError(
      sprintErrors.SPRINT_NOT_FOUND.message,
      sprintErrors.SPRINT_NOT_FOUND.code,
      sprintErrors.SPRINT_NOT_FOUND.errorCode,
      sprintErrors.SPRINT_NOT_FOUND.suggestion,
    );
  }

  // Check the project existence
  const project = await Project.findById(sprint.projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  return { sprint, project };
};

// Update or create the sprint review meeting based on the sprint schedule changes
export const upsertSprintReviewMeeting = async (sprint, project) => {
  // Check if a sprint review meeting already exists
  const existingMeeting = await Meeting.findOne({
    sprintId: sprint._id,
  });

  const isNewMeeting = !existingMeeting;

  // Get the project team
  const team = await Team.findOne({ projectId: project._id });
  if (!team) {
    throw new AppError(
      projectErrors.TEAM_NOT_FOUND.message,
      projectErrors.TEAM_NOT_FOUND.code,
      projectErrors.TEAM_NOT_FOUND.errorCode,
      projectErrors.TEAM_NOT_FOUND.suggestion,
    );
  }

  // Get all team members
  const teamMembers = await TeamMember.find({ teamId: team._id });
  if (!teamMembers || teamMembers.length === 0) {
    return null; // No team members, so we can't create a sprint review meeting automatically
  }

  // Build the attendees list
  const attendees = teamMembers.map((member) => ({
    userId: member.userId,
    status: "Pending",
  }));

  // Add the product owner as automatically accepted
  const existingPO = attendees.find(
    (att) => att.userId.toString() === project.productOwnerId.toString(),
  );

  if (existingPO) {
    existingPO.status = "Accepted";
    existingPO.respondedAt = new Date();
  } else {
    attendees.push({
      userId: project.productOwnerId,
      status: "Accepted",
      respondedAt: new Date(),
    });
  }

  // Compute meeting date (end of sprint + 1 day)
  const meetingDate = new Date(sprint.endDate);
  meetingDate.setDate(meetingDate.getDate() + 1);
  meetingDate.setHours(10, 0, 0, 0);

  // Upsert (create OR update existing meeting)
  const meeting = await Meeting.findOneAndUpdate(
    {
      sprintId: sprint._id,
    },
    {
      title: `Sprint ${sprint.number} Review`,
      description: `Sprint review meeting for "${sprint.name}"`,
      projectId: project._id,
      sprintId: sprint._id,
      date: meetingDate,
      startTime: "10:00",
      endTime: "11:00",
      locationType: "Online",
      meetingLink: "https://discord.gg/m2yau6R4", // The DotJcoM Discord server link
      address: null,
      priority: "Medium",
      reminder: 15,
      attendees,
      createdBy: project.productOwnerId,
    },
    {
      returnDocument: "after",
      upsert: true,
    },
  );

  // Send notifications to attendees (including the product owner)
  try {
    await notifyMeetingAttendees({
      meeting,
      project,
      title: isNewMeeting
        ? "Sprint review meeting scheduled"
        : "Sprint review meeting updated",
      message: isNewMeeting
        ? `A sprint review meeting for Sprint ${sprint.number} has been scheduled in project "${project.name}".`
        : `The sprint review meeting for Sprint ${sprint.number} has been updated in project "${project.name}".`,
      excludeProductOwner: false,
    });
  } catch (err) {
    console.error("Failed to send sprint review meeting notifications:", err);
  }
};
