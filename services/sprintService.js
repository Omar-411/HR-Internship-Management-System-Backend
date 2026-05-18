import Sprint from "../models/Sprint.js";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import TeamMember from "../models/TeamMember.js";
import { getOne, getAll } from "./handlersFactory.js";
import { errors } from "../errors/sprintErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors as projectErrors } from "../errors/projectErrors.js";
import AppError from "../utils/AppError.js";
import { isProjectInactive } from "../validators/projectValidators.js";
import { isTeamMemberOrProductOwnerOrAdmin } from "../utils/projectHelpers.js";
import { validateSprintFields } from "../validators/sprintValidators.js";
import {
  checkSprintAndProjectExistence,
  upsertSprintReviewMeeting,
} from "../utils/sprintHelpers.js";
import { isEmpty } from "../validators/userValidators.js";
import {
  notifyProjectMembers,
  notifyProjectDeletion,
} from "../utils/notificationHelpers.js";

// Get all sprints of a project
export const getAllSprintsOfProject = async (queryParams) => {
  let { projectId, user } = queryParams;
  const { role, id: userId } = user;

  // Check the project existence
  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Authorization Control: Only team members, product owner of the project and admins can access the sprints of the project
  await isTeamMemberOrProductOwnerOrAdmin(
    project,
    user,
    errors.UNAUTHORIZED_TO_ACCESS_PROJECT_SPRINTS,
  );

  // Filter the user token from the query parameters
  delete queryParams.user;

  return await getAll(
    Sprint,
    [{ path: "projectId", select: "name sector status" }],
    null,
    ["name"],
  )(queryParams);
};

// Get a sprint by Id
export const getSprintById = async (sprintId, user) => {
  const { id: userId, role } = user;

  // Check the sprint existence
  const sprint = await Sprint.findById(sprintId);
  if (!sprint) {
    throw new AppError(
      errors.SPRINT_NOT_FOUND.message,
      errors.SPRINT_NOT_FOUND.code,
      errors.SPRINT_NOT_FOUND.errorCode,
      errors.SPRINT_NOT_FOUND.suggestion,
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

  // Authorization Control: Only team members, product owner of the project and admins can access a sprint details
  await isTeamMemberOrProductOwnerOrAdmin(
    project,
    user,
    errors.UNAUTHORIZED_TO_ACCESS_SPRINT,
  );

  return await getOne(Sprint, errors.SPRINT_NOT_FOUND, [
    { path: "projectId", select: "name sector status" },
  ])(sprintId);
};

// Create a new sprint
export const createSprint = async (req) => {
  const { id: userId } = req.user;
  const { projectId } = req.params;
  const { name, goal, startDate, durationInWeeks = 2 } = req.body;

  // Check the project existence
  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Check if the project is archived, completed or on hold
  isProjectInactive(project);

  // Authorization Control: Only the product owner of the project can create a sprint
  if (project.productOwnerId.toString() !== userId.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_CREATE_SPRINT.message,
      errors.UNAUTHORIZED_TO_CREATE_SPRINT.code,
      errors.UNAUTHORIZED_TO_CREATE_SPRINT.errorCode,
      errors.UNAUTHORIZED_TO_CREATE_SPRINT.suggestion,
    );
  }

  // Input validation
  validateSprintFields(req.body, project, { isUpdate: false });

  // Automatically calculate the end date based on the start date and duration
  const end = new Date(startDate);
  end.setDate(end.getDate() + durationInWeeks * 7);
  if (end > project.dueDate) {
    throw new AppError(
      errors.SPRINT_END_DATE_EXCEEDS_PROJECT_END_DATE.message,
      errors.SPRINT_END_DATE_EXCEEDS_PROJECT_END_DATE.code,
      errors.SPRINT_END_DATE_EXCEEDS_PROJECT_END_DATE.errorCode,
      errors.SPRINT_END_DATE_EXCEEDS_PROJECT_END_DATE.suggestion,
    );
  }

  // Generate the sprint number
  const lastSprint = await Sprint.findOne({ projectId }).sort({ number: -1 });
  const sprintNumber = lastSprint ? lastSprint.number + 1 : 1;

  // Check if we have overlapping sprints in the same project
  const overlappingSprint = await Sprint.findOne({
    projectId,
    $or: [
      {
        startDate: { $lte: end },
        endDate: { $gte: startDate },
      },
    ],
  });

  if (overlappingSprint) {
    throw new AppError(
      errors.SPRINT_OVERLAPPING.message,
      errors.SPRINT_OVERLAPPING.code,
      errors.SPRINT_OVERLAPPING.errorCode,
      errors.SPRINT_OVERLAPPING.suggestion,
    );
  }

  // Create the sprint
  const sprint = await Sprint.create({
    number: sprintNumber,
    name,
    goal,
    projectId,
    startDate: startDate,
    endDate: end,
    durationInWeeks,
    status: "Planned",
  });

  // Plan the sprint review meeting
  await upsertSprintReviewMeeting(sprint, project);

  // Notify the active project members about the new sprint
  try {
    await notifyProjectMembers({
      projectId: project._id,
      excludedUserIds: [userId],
      type: "SPRINT",
      title: "New Sprint Created",
      message: `A new sprint "${sprint.name}" has been created for the project "${project.name}".`,
      data: {
        entityType: "PROJECT",
        entityId: project._id,
      },
    });
  } catch (err) {
    console.error("Failed to notify team members about sprint creation:", err);
  }

  return {
    status: "Success",
    message: "Sprint created successfully!",
    code: 201,
    data: sprint,
  };
};

// Update a sprint
export const updateSprint = async (sprintId, updates, user) => {
  const { id: userId } = user;

  // Check the sprint and project existence
  const { sprint, project } = await checkSprintAndProjectExistence(sprintId);

  // Check if the project is archived, completed or on hold
  isProjectInactive(project);

  // Check if the sprint is already completed or active
  if (sprint.status !== "Planned") {
    throw new AppError(
      errors.SPRINT_ALREADY_STARTED_OR_COMPLETED.message,
      errors.SPRINT_ALREADY_STARTED_OR_COMPLETED.code,
      errors.SPRINT_ALREADY_STARTED_OR_COMPLETED.errorCode,
      errors.SPRINT_ALREADY_STARTED_OR_COMPLETED.suggestion,
    );
  }

  // Authorization Control: Only the product owner of the project can update a sprint
  if (project.productOwnerId.toString() !== userId.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_UPDATE_SPRINT.message,
      errors.UNAUTHORIZED_TO_UPDATE_SPRINT.code,
      errors.UNAUTHORIZED_TO_UPDATE_SPRINT.errorCode,
      errors.UNAUTHORIZED_TO_UPDATE_SPRINT.suggestion,
    );
  }

  // Validate the input fields
  validateSprintFields(updates, project, { isUpdate: true });

  // Detect if the sprint schedule is being changed to update the sprint review meeting accordingly
  const isScheduleChanged =
    updates.startDate !== undefined || updates.durationInWeeks !== undefined;

  // Assign the updated fields to the sprint
  if (updates.name !== undefined) sprint.name = updates.name;
  if (updates.goal !== undefined) sprint.goal = updates.goal;
  if (updates.startDate !== undefined) sprint.startDate = updates.startDate;
  if (updates.durationInWeeks !== undefined)
    sprint.durationInWeeks = updates.durationInWeeks;

  // Recompute the end date in case of an update
  const start = new Date(sprint.startDate);
  const duration = sprint.durationInWeeks;
  const end = new Date(start);
  end.setDate(end.getDate() + duration * 7);

  if (project.dueDate && end > project.dueDate) {
    throw new AppError(
      errors.SPRINT_END_DATE_EXCEEDS_PROJECT_END_DATE.message,
      errors.SPRINT_END_DATE_EXCEEDS_PROJECT_END_DATE.code,
      errors.SPRINT_END_DATE_EXCEEDS_PROJECT_END_DATE.errorCode,
      errors.SPRINT_END_DATE_EXCEEDS_PROJECT_END_DATE.suggestion,
    );
  }

  sprint.endDate = end;

  // Check for sprint overlaps
  const overlappingSprint = await Sprint.findOne({
    projectId: sprint.projectId,
    _id: { $ne: sprintId },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });

  if (overlappingSprint) {
    throw new AppError(
      errors.SPRINT_OVERLAPPING.message,
      errors.SPRINT_OVERLAPPING.code,
      errors.SPRINT_OVERLAPPING.errorCode,
      errors.SPRINT_OVERLAPPING.suggestion,
    );
  }

  // Save the changes
  await sprint.save();
  if (isScheduleChanged) {
    await upsertSprintReviewMeeting(sprint, project);
  }

  // Notify the active project members about the updated sprint
  try {
    await notifyProjectMembers({
      projectId: project._id,
      excludedUserIds: [userId],
      type: "SPRINT",
      title: "Sprint Updated",
      message: `The sprint "${sprint.name}" has been updated in the project "${project.name}".`,
      data: {
        entityType: "PROJECT",
        entityId: project._id,
      },
    });
  } catch (err) {
    console.error("Failed to notify team members about sprint update:", err);
  }

  return {
    status: "Success",
    code: 200,
    message: "Sprint updated successfully!",
    data: sprint,
  };
};

// Delete a sprint
export const deleteSprint = async (sprintId, user) => {
  // Get the user details from the token
  const { id: userId } = user;

  // Check the sprint and project existence
  const { sprint, project } = await checkSprintAndProjectExistence(sprintId);

  // Check if the project is archived, completed or on hold
  isProjectInactive(project);

  // Authorization Control: Only the product owner of the project can delete a sprint
  if (project.productOwnerId.toString() !== userId.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_DELETE_SPRINT.message,
      errors.UNAUTHORIZED_TO_DELETE_SPRINT.code,
      errors.UNAUTHORIZED_TO_DELETE_SPRINT.errorCode,
      errors.UNAUTHORIZED_TO_DELETE_SPRINT.suggestion,
    );
  }

  // Move the sprint tasks to backlog before deleting the sprint
  const tasksInSprint = await Task.find({ sprintId });
  if (tasksInSprint.length > 0) {
    await Task.updateMany(
      { sprintId },
      {
        $set: {
          sprintId: null,
          status: "Backlog",
        },
      },
    );
  }

  // Delete the sprint
  await Sprint.findByIdAndDelete(sprintId);

  // Notify the active project members about the deleted sprint
  try {
    await notifyProjectMembers({
      projectId: project._id,
      excludedUserIds: [userId],
      type: "SPRINT",
      title: "Sprint Deleted",
      message: `The sprint "${sprint.name}" has been deleted for the project "${project.name}".`,
      data: {
        entityType: "SPRINT",
        entityId: sprint._id,
      },
    });
  } catch (err) {
    console.error("Failed to notify team members about sprint deletion:", err);
  }

  return {
    status: "Success",
    code: 200,
    message: "Sprint Deleted successfully!",
  };
};

// Start a sprint
export const startSprint = async (sprintId, user) => {
  // Get the user details from the token
  const { id: userId } = user;

  // Check the sprint and project existence
  const { sprint, project } = await checkSprintAndProjectExistence(sprintId);

  // Check if the project is archived, completed or on hold
  isProjectInactive(project);

  // Check if the sprint is in "Planned" status to be able to start it
  if (sprint.status !== "Planned") {
    throw new AppError(
      errors.SPRINT_ALREADY_STARTED_OR_COMPLETED.message,
      errors.SPRINT_ALREADY_STARTED_OR_COMPLETED.code,
      errors.SPRINT_ALREADY_STARTED_OR_COMPLETED.errorCode,
      errors.SPRINT_ALREADY_STARTED_OR_COMPLETED.suggestion,
    );
  }

  // Check if the product owner of the project is the one starting the sprint
  if (project.productOwnerId.toString() !== userId.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_START_SPRINT.message,
      errors.UNAUTHORIZED_TO_START_SPRINT.code,
      errors.UNAUTHORIZED_TO_START_SPRINT.errorCode,
      errors.UNAUTHORIZED_TO_START_SPRINT.suggestion,
    );
  }

  // Check that only one active sprint per project
  const activeSprint = await Sprint.findOne({
    projectId: sprint.projectId,
    status: "Active",
  });
  if (activeSprint) {
    throw new AppError(
      errors.ACTIVE_SPRINT_ALREADY_EXISTS.message,
      errors.ACTIVE_SPRINT_ALREADY_EXISTS.code,
      errors.ACTIVE_SPRINT_ALREADY_EXISTS.errorCode,
      errors.ACTIVE_SPRINT_ALREADY_EXISTS.suggestion,
    );
  }

  // Adjust start date to today (In case of a late start to the sprint)
  const today = new Date().toISOString().split("T")[0];
  const sprintStart = sprint.startDate.toISOString().split("T")[0];

  if (sprintStart < today) {
    sprint.startDate = today;

    // Recompute the endDate based on duration
    const end = new Date(today);
    end.setDate(end.getDate() + sprint.durationInWeeks * 7);
    sprint.endDate = end;

    // Update the sprint review meeting date based on the new end date
    await upsertSprintReviewMeeting(sprint, project);
  }

  // Update sprint status
  sprint.status = "Active";
  await sprint.save();

  // Move tasks to "To Do"
  await Task.updateMany(
    {
      sprintId: sprint._id,
      status: "Backlog",
    },
    {
      $set: { status: "To Do" },
    },
  );

  // Notify the active project members about the started sprint
  try {
    await notifyProjectMembers({
      projectId: project._id,
      excludedUserIds: [userId],
      type: "SPRINT",
      title: "Sprint Started",
      message: `The sprint "${sprint.name}" is now active for the project "${project.name}".`,
      data: {
        entityType: "SPRINT",
        entityId: sprint._id,
      },
    });
  } catch (err) {
    console.error("Failed to notify team members about sprint start:", err);
  }

  return {
    status: "Success",
    code: 200,
    message: "Sprint started successfully!",
    data: sprint,
  };
};

// Complete a sprint
export const completeSprint = async (sprintId, user) => {
  const { id: userId } = user;

  // Check the sprint and project existence
  const { sprint, project } = await checkSprintAndProjectExistence(sprintId);

  // Check if the project is archived, completed or on hold
  isProjectInactive(project);

  // If a sprint is not active, it cannot be completed
  if (sprint.status !== "Active") {
    throw new AppError(
      errors.SPRINT_NOT_ACTIVE.message,
      errors.SPRINT_NOT_ACTIVE.code,
      errors.SPRINT_NOT_ACTIVE.errorCode,
      errors.SPRINT_NOT_ACTIVE.suggestion,
    );
  }

  // Only the product owner of the project can complete a sprint
  if (project.productOwnerId.toString() !== userId.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_COMPLETE_SPRINT.message,
      errors.UNAUTHORIZED_TO_COMPLETE_SPRINT.code,
      errors.UNAUTHORIZED_TO_COMPLETE_SPRINT.errorCode,
      errors.UNAUTHORIZED_TO_COMPLETE_SPRINT.suggestion,
    );
  }

  // Handle unfinished tasks: Move them to the backlog
  const unfinishedTasks = await Task.find({
    sprintId: sprint._id,
    status: { $ne: "Done" },
  });
  if (unfinishedTasks.length > 0) {
    await Task.updateMany(
      {
        sprintId: sprint._id,
        status: { $ne: "Done" },
      },
      {
        $set: {
          sprintId: null,
          status: "Backlog",
        },
      },
    );
  }

  // Mark the sprint as completed
  sprint.status = "Completed";
  sprint.completedAt = new Date();
  await sprint.save();

  // Notify the active project members about the completed sprint
  try {
    await notifyProjectMembers({
      projectId: project._id,
      excludedUserIds: [userId],
      type: "SPRINT",
      title: "Sprint Completed",
      message: `The sprint "${sprint.name}" has been completed for the project "${project.name}".`,
      data: {
        entityType: "SPRINT",
        entityId: sprint._id,
      },
    });
  } catch (err) {
    console.error(
      "Failed to notify team members about sprint completion:",
      err,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Sprint completed successfully!",
    data: sprint,
  };
};
