// STILL NEED REFACTORING, JUST UNIFIED THE RESPONSE //
import mongoose from "mongoose";
import Project from "../models/Project.js";
import Sprint from "../models/Sprint.js";
import TeamMember from "../models/TeamMember.js";
import Task from "../models/Task.js";
import { errors } from "../errors/taskErrors.js";
import { errors as sprintErrors } from "../errors/sprintErrors.js";
import { errors as projectErrors } from "../errors/projectErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors as teamErrors } from "../errors/teamErrors.js";
import AppError from "../utils/AppError.js";
import {
  uploadDocToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";
import { isProjectInactive } from "../validators/projectValidators.js";
import { isTeamMemberOrProductOwnerOrAdmin } from "../utils/projectHelpers.js";
import { normalizeStatus } from "../utils/taskHelpers.js";

// Get all the statuses of a task
export const getAllTaskStatuses = async (req, res, next) => {
  try {
    const statuses = Task.schema.path("status").enumValues;

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Task statuses retrieved successfully!",
      data: statuses,
    });
  } catch (err) {
    next(err);
  }
};

// Get all the priorities of a task
export const getAllTaskPriorities = async (req, res, next) => {
  try {
    const priorities = Task.schema.path("priority").enumValues;

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Task priorities retrieved successfully!",
      data: priorities,
    });
  } catch (err) {
    next(err);
  }
};

// Get all the types of a task
export const getAllTaskTypes = async (req, res, next) => {
  try {
    const types = Task.schema.path("type").enumValues;

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Task types retrieved successfully!",
      data: types,
    });
  } catch (err) {
    next(err);
  }
};

// Get All tasks for a specific project
export const getProjectTasks = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    // Explicitly cast to ObjectId to avoid CastError if frontend sends string
    const objectId = new mongoose.Types.ObjectId(projectId);
    const { sprintId, page = 1, type, status } = req.query;

    const limit = 10;
    const parsedPage = Math.max(parseInt(page), 1);
    const skip = (parsedPage - 1) * limit;

    // Check project existence
    const project = await Project.findById(objectId);
    if (!project) {
      throw new AppError(
        projectErrors.PROJECT_NOT_FOUND.message,
        projectErrors.PROJECT_NOT_FOUND.code,
        projectErrors.PROJECT_NOT_FOUND.errorCode,
        projectErrors.PROJECT_NOT_FOUND.suggestion,
      );
    }

    // Authorization check: Admin + Product owner of the project + Team members of the project can access the project tasks
    await isTeamMemberOrProductOwnerOrAdmin(
      project,
      req.user,
      errors.UNAUTHORIZED_TO_ACCESS_PROJECT_TASKS,
    );

    // Build the filter
    const filter = { projectId: objectId };

    // Filter by sprint (If NOT provided, then we return all the tasks (backlog + sprint tasks))
    if (sprintId) {
      // Check the sprint existance
      const sprint = await Sprint.findById(sprintId);
      if (!sprint || sprint.projectId.toString() !== objectId.toString()) {
        throw new AppError(
          sprintErrors.SPRINT_NOT_FOUND.message,
          sprintErrors.SPRINT_NOT_FOUND.code,
          sprintErrors.SPRINT_NOT_FOUND.errorCode,
          sprintErrors.SPRINT_NOT_FOUND.suggestion,
        );
      }

      filter.sprintId = sprintId;
    }

    // Filter by type (Story, Task, Sub-task, Bug)
    if (type) {
      const validTypes = Task.schema.path("type").enumValues;
      if (!validTypes.includes(type)) {
        throw new AppError(
          errors.INVALID_TASK_TYPE.message,
          errors.INVALID_TASK_TYPE.code,
          errors.INVALID_TASK_TYPE.errorCode,
          errors.INVALID_TASK_TYPE.suggestion,
        );
      }

      filter.type = type;
    }

    // Filter by status (Backlog, To Do, In Progress, Review, Done)
    if (status) {
      const validStatuses = Task.schema.path("status").enumValues;
      if (!validStatuses.includes(status)) {
        throw new AppError(
          errors.INVALID_TASK_STATUS.message,
          errors.INVALID_TASK_STATUS.code,
          errors.INVALID_TASK_STATUS.errorCode,
          errors.INVALID_TASK_STATUS.suggestion,
        );
      }

      filter.status = status;
    }

    // Prepare the project tasks (apply pagination via .skip + .limit)
    const tasks = await Task.find(filter)
      .populate("assignedTo", "name lastName profileImageURL role")
      .populate("sprintId", "number name goal status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Count the total number of tasks
    const totalTasks = await Task.countDocuments(filter);

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Tasks retrieved successfully!",
      data: tasks,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(totalTasks / limit),
        limitPerPage: limit,
        totalCount: totalTasks,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get My Tasks (Assigned to the logged in user)
export const getMyTasks = async (req, res, next) => {
  try {
    // Get the logged in user ID from the token
    const userId = req.user.id;

    const {
      page = 1,
      search,
      status,
      priority,
      type,
      projectId,
      sprintId,
    } = req.query;

    const limit = 10;
    const parsedPage = Math.max(parseInt(page), 1);
    const skip = (parsedPage - 1) * limit;

    // Build the filter
    const filter = {
      assignedTo: userId,
    };

    // Filter by Status (Backlog, To Do, In Progress, Review, Done)
    if (status) {
      const validStatuses = Task.schema.path("status").enumValues;
      if (!validStatuses.includes(status)) {
        throw new AppError(
          errors.INVALID_TASK_STATUS.message,
          errors.INVALID_TASK_STATUS.code,
          errors.INVALID_TASK_STATUS.errorCode,
          errors.INVALID_TASK_STATUS.suggestion,
        );
      }

      filter.status = status;
    }

    // Filter by Priority (Low, Medium, High)
    if (priority) {
      const validPriorities = Task.schema.path("priority").enumValues;
      if (!validPriorities.includes(priority)) {
        throw new AppError(
          errors.INVALID_TASK_PRIORITY.message,
          errors.INVALID_TASK_PRIORITY.code,
          errors.INVALID_TASK_PRIORITY.errorCode,
          errors.INVALID_TASK_PRIORITY.suggestion,
        );
      }

      filter.priority = priority;
    }

    // Filter by Type (Story, Task, Sub-task, Bug)
    if (type) {
      const validTypes = Task.schema.path("type").enumValues;
      if (!validTypes.includes(type)) {
        throw new AppError(
          errors.INVALID_TASK_TYPE.message,
          errors.INVALID_TASK_TYPE.code,
          errors.INVALID_TASK_TYPE.errorCode,
          errors.INVALID_TASK_TYPE.suggestion,
        );
      }

      filter.type = type;
    }

    // Filter by Project ID
    if (projectId) {
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

      filter.projectId = projectId;
    }

    // Filter by Sprint ID
    if (sprintId) {
      // Check the sprint existence
      const sprint = await Sprint.findById(sprintId);
      if (
        !sprint ||
        (projectId &&
          sprint.projectId.toString() !== filter.projectId.toString())
      ) {
        throw new AppError(
          sprintErrors.SPRINT_NOT_FOUND.message,
          sprintErrors.SPRINT_NOT_FOUND.code,
          sprintErrors.SPRINT_NOT_FOUND.errorCode,
          sprintErrors.SPRINT_NOT_FOUND.suggestion,
        );
      }

      filter.sprintId = sprintId;
    }

    // Search by the task title
    if (search) {
      filter.title = { $regex: search, $options: "i" };
    }

    // Fetch the paginated tasks
    const tasks = await Task.find(filter)
      .populate("projectId", "name status")
      .populate("sprintId", "number name status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Count the total tasks
    const totalTasks = await Task.countDocuments(filter);

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "List of tasks retrieved successfully!",
      data: tasks,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(totalTasks / limit),
        limitPerPage: limit,
        totalCount: totalTasks,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get task by Id
export const getTaskById = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    // Check task existence
    const task = await Task.findById(taskId)
      .populate("assignedTo", "name lastName profileImageURL")
      .populate("sprintId", "number name goal status");

    if (!task) {
      throw new AppError(
        errors.TASK_NOT_FOUND.message,
        errors.TASK_NOT_FOUND.code,
        errors.TASK_NOT_FOUND.errorCode,
        errors.TASK_NOT_FOUND.suggestion,
      );
    }

    // Check project existence
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError(
        projectErrors.PROJECT_NOT_FOUND.message,
        projectErrors.PROJECT_NOT_FOUND.code,
        projectErrors.PROJECT_NOT_FOUND.errorCode,
        projectErrors.PROJECT_NOT_FOUND.suggestion,
      );
    }

    // Access control: Admin + Product owner of the project + Team members of the project can access the task details
    await isTeamMemberOrProductOwnerOrAdmin(
      project,
      req.user,
      errors.UNAUTHORIZED_TO_ACCESS_PROJECT_TASKS,
    );

    // Get the subtasks of the task (if there is any)
    const subTasks = await Task.find({ parentTaskId: task._id }).populate(
      "assignedTo",
      "name lastName profileImageURL",
    );

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Task retrieved successfully!",
      data: {
        task,
        subTasks,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Add a task to a specific project (Product owner only)
export const addTask = async (req, res, next) => {
  try {
    // Get the project ID to which the task will be added
    const { id } = req.params;
    const objectId = new mongoose.Types.ObjectId(id);

    const {
      title,
      type = "Task",
      description,
      priority,
      storyPoints,
      parentTaskId,
      assignees,
      sprintId,
      startDate,
      dueDate,
    } = req.body;

    // Check the project existence
    const project = await Project.findById(id);
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

    // Check the required fields
    if (!title) {
      throw new AppError(
        errors.TASK_TITLE_REQUIRED.message,
        errors.TASK_TITLE_REQUIRED.code,
        errors.TASK_TITLE_REQUIRED.errorCode,
        errors.TASK_TITLE_REQUIRED.suggestion,
      );
    }

    // Check the story points validity
    if (
      storyPoints &&
      !Task.schema.path("storyPoints").enumValues.includes(storyPoints)
    ) {
      throw new AppError(
        errors.INVALID_STORY_POINTS.message,
        errors.INVALID_STORY_POINTS.code,
        errors.INVALID_STORY_POINTS.errorCode,
        errors.INVALID_STORY_POINTS.suggestion,
      );
    }

    // Check the priority validity
    if (
      priority &&
      !Task.schema.path("priority").enumValues.includes(priority)
    ) {
      throw new AppError(
        errors.INVALID_PRIORITY.message,
        errors.INVALID_PRIORITY.code,
        errors.INVALID_PRIORITY.errorCode,
        errors.INVALID_PRIORITY.suggestion,
      );
    }

    // Check the type validity
    if (type && !Task.schema.path("type").enumValues.includes(type)) {
      throw new AppError(
        errors.INVALID_TASK_TYPE.message,
        errors.INVALID_TASK_TYPE.code,
        errors.INVALID_TASK_TYPE.errorCode,
        errors.INVALID_TASK_TYPE.suggestion,
      );
    }

    // Authorization Check: Only the product owner of the project can add a task
    const { role, id: userId } = req.user;
    if (project.productOwnerId.toString() !== userId.toString()) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_ADD_PROJECT_TASKS.message,
        errors.UNAUTHORIZED_TO_ADD_PROJECT_TASKS.code,
        errors.UNAUTHORIZED_TO_ADD_PROJECT_TASKS.errorCode,
        errors.UNAUTHORIZED_TO_ADD_PROJECT_TASKS.suggestion,
      );
    }

    // The Sub-task validation: Must have a parent task
    if (type === "Sub-task") {
      if (!parentTaskId) {
        throw new AppError(
          errors.SUB_TASK_REQUIRES_PARENT.message,
          errors.SUB_TASK_REQUIRES_PARENT.code,
          errors.SUB_TASK_REQUIRES_PARENT.errorCode,
          errors.SUB_TASK_REQUIRES_PARENT.suggestion,
        );
      }

      // Check the parent task existence
      const parent = await Task.findById(parentTaskId);
      if (!parent || parent.projectId.toString() !== id.toString()) {
        throw new AppError(
          errors.PARENT_TASK_NOT_FOUND.message,
          errors.PARENT_TASK_NOT_FOUND.code,
          errors.PARENT_TASK_NOT_FOUND.errorCode,
          errors.PARENT_TASK_NOT_FOUND.suggestion,
        );
      }

      // Check if the parent task is not a sub-task (Only one level of sub-tasks is allowed)
      if (parent.parentTaskId) {
        throw new AppError(
          errors.MORE_THAN_ONE_LEVEL_OF_SUBTASKS.message,
          errors.MORE_THAN_ONE_LEVEL_OF_SUBTASKS.code,
          errors.MORE_THAN_ONE_LEVEL_OF_SUBTASKS.errorCode,
          errors.MORE_THAN_ONE_LEVEL_OF_SUBTASKS.suggestion,
        );
      }
    } else {
      if (parentTaskId) {
        throw new AppError(
          errors.SUB_TASK_REQUIRES_PARENT.message,
          errors.SUB_TASK_REQUIRES_PARENT.code,
          errors.SUB_TASK_REQUIRES_PARENT.errorCode,
          errors.SUB_TASK_REQUIRES_PARENT.suggestion,
        );
      }
    }

    // Sprint validation and status assignment
    let validSprintId = null;
    let sprint = null;
    let status = "Backlog";

    if (sprintId) {
      // Check the sprint existence
      sprint = await Sprint.findById(sprintId);
      if (!sprint || sprint.projectId.toString() !== id.toString()) {
        throw new AppError(
          sprintErrors.SPRINT_NOT_FOUND.message,
          sprintErrors.SPRINT_NOT_FOUND.code,
          sprintErrors.SPRINT_NOT_FOUND.errorCode,
          sprintErrors.SPRINT_NOT_FOUND.suggestion,
        );
      }

      // Check if the sprint is not completed
      if (sprint.status === "Completed") {
        throw new AppError(
          errors.COMPLETED_SPRINT.message,
          errors.COMPLETED_SPRINT.code,
          errors.COMPLETED_SPRINT.errorCode,
          errors.COMPLETED_SPRINT.suggestion,
        );
      }

      validSprintId = sprintId;

      // Change the status to "To Do" if the task is added to an active sprint
      if (sprint.status === "Active") {
        status = "To Do";
      }
    }

    // User Assignment validation
    let validAssignedTo = null;
    if (assignees && Array.isArray(assignees) && assignees.length > 0) {
      // 1. Verify all selected users exist in DB
      const users = await mongoose.model("User").find({ _id: { $in: assignees } });
      console.log("FOUND USERS:", users);
      if (users.length !== assignees.length) {
        console.log("❌ FAIL REASON: users not found in DB");
        throw new AppError(
          commonErrors.USER_NOT_FOUND.message,
          commonErrors.USER_NOT_FOUND.code,
          commonErrors.USER_NOT_FOUND.errorCode,
          commonErrors.USER_NOT_FOUND.suggestion,
        );
      }

      // 2. Ensure the selected user is a team member of the project
      validAssignedTo = assignees[0];
      const membership = await TeamMember.findOne({
        userId: validAssignedTo,
        teamId: project.team_id,
      });

      if (!membership) {
        console.log("❌ FAIL REASON: user is not a member of project team");
        throw new AppError(
          commonErrors.USER_NOT_FOUND.message,
          commonErrors.USER_NOT_FOUND.code,
          commonErrors.USER_NOT_FOUND.errorCode,
          "User is not a member of the project team.",
        );
      }
    }

    // Create task
    const task = await Task.create({
      title,
      description,
      status: normalizeStatus(status),
      priority,
      storyPoints,
      type,
      parentTaskId: parentTaskId || null,
      assignedTo: validAssignedTo || null,
      projectId: objectId,
      sprintId: validSprintId || null,
      startDate: startDate || null,
      dueDate: dueDate || null,
    });

    // Emit socket event for real-time update
    const io = req.app.get("io");
    if (io) {
      io.emit("taskCreated", { projectId: id, task });
    }

    res.status(201).json({
      status: "Success",
      code: 201,
      message: "Task created successfully!",
      data: task,
    });
  } catch (err) {
    next(err);
  }
};

// Update a task (Product owner only)
export const updateTask = async (req, res, next) => {
  try {
    // Get the task Id
    const { taskId } = req.params;
    const { id: userId } = req.user;
    const updates = req.body;

    // Check the task existence
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError(
        errors.TASK_NOT_FOUND.message,
        errors.TASK_NOT_FOUND.code,
        errors.TASK_NOT_FOUND.errorCode,
        errors.TASK_NOT_FOUND.suggestion,
      );
    }

    // Check the project existence
    const project = await Project.findById(task.projectId);
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

    // Authorization Check: Only the product owner of the project can update a task
    if (project.productOwnerId.toString() !== userId.toString()) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_UPDATE_PROJECT_TASKS.message,
        errors.UNAUTHORIZED_TO_UPDATE_PROJECT_TASKS.code,
        errors.UNAUTHORIZED_TO_UPDATE_PROJECT_TASKS.errorCode,
        errors.UNAUTHORIZED_TO_UPDATE_PROJECT_TASKS.suggestion,
      );
    }

    // Validate if the type is changed to "Sub-task"
    if (updates.type === "Sub-task") {
      if (!updates.parentTaskId) {
        throw new AppError(
          errors.SUB_TASK_REQUIRES_PARENT.message,
          errors.SUB_TASK_REQUIRES_PARENT.code,
          errors.SUB_TASK_REQUIRES_PARENT.errorCode,
          errors.SUB_TASK_REQUIRES_PARENT.suggestion,
        );
      }

      // Check the parent task validity
      const parent = await Task.findById(updates.parentTaskId);
      if (!parent || parent.projectId.toString() !== project._id.toString()) {
        throw new AppError(
          errors.PARENT_TASK_NOT_FOUND.message,
          errors.PARENT_TASK_NOT_FOUND.code,
          errors.PARENT_TASK_NOT_FOUND.errorCode,
          errors.PARENT_TASK_NOT_FOUND.suggestion,
        );
      }

      if (parent.parentTaskId) {
        throw new AppError(
          errors.MORE_THAN_ONE_LEVEL_OF_SUBTASKS.message,
          errors.MORE_THAN_ONE_LEVEL_OF_SUBTASKS.code,
          errors.MORE_THAN_ONE_LEVEL_OF_SUBTASKS.errorCode,
          errors.MORE_THAN_ONE_LEVEL_OF_SUBTASKS.suggestion,
        );
      }
    } else if (updates.parentTaskId) {
      throw new AppError(
        errors.SUB_TASK_REQUIRES_PARENT.message,
        errors.SUB_TASK_REQUIRES_PARENT.code,
        errors.SUB_TASK_REQUIRES_PARENT.errorCode,
        errors.SUB_TASK_REQUIRES_PARENT.suggestion,
      );
    }

    // Validate the Sprint logic
    let sprint = null;

    if (updates.sprintId !== undefined) {
      if (updates.sprintId === null) {
        // Move to Backlog status if removed from a sprint
        task.sprintId = null;
        task.status = "Backlog";
      } else {
        // Check the sprint existence
        sprint = await Sprint.findById(updates.sprintId);
        if (!sprint || sprint.projectId.toString() !== project._id.toString()) {
          throw new AppError(
            sprintErrors.SPRINT_NOT_FOUND.message,
            sprintErrors.SPRINT_NOT_FOUND.code,
            sprintErrors.SPRINT_NOT_FOUND.errorCode,
            sprintErrors.SPRINT_NOT_FOUND.suggestion,
          );
        }

        // Check if the sprint is not completed
        if (sprint.status === "Completed") {
          throw new AppError(
            errors.COMPLETED_SPRINT.message,
            errors.COMPLETED_SPRINT.code,
            errors.COMPLETED_SPRINT.errorCode,
            errors.COMPLETED_SPRINT.suggestion,
          );
        }

        task.sprintId = updates.sprintId;

        // Change the status to "To Do" if the task is added to an active sprint from backlog
        if (sprint.status === "Active" && task.status === "Backlog") {
          task.status = "To Do";
        }
      }
    }

    // Validate the Status workflow rules
    if (updates.status) {
      const nextStatus = normalizeStatus(updates.status);

      // Check the new status validity
      if (!Task.schema.path("status").enumValues.includes(nextStatus)) {
        throw new AppError(
          errors.INVALID_TASK_STATUS.message,
          errors.INVALID_TASK_STATUS.code,
          errors.INVALID_TASK_STATUS.errorCode,
          errors.INVALID_TASK_STATUS.suggestion,
        );
      }

      task.status = nextStatus;

      if (nextStatus === "Done") {
        // Check if its sub tasks are done before marking the parent task as done
        const subTasks = await Task.find({ parentTaskId: task._id });
        if (subTasks.length === 0) {
          task.completedAt = new Date();
        } else {
          const incompleteSubTasks = subTasks.filter(
            (t) => t.status !== "Done",
          );
          if (incompleteSubTasks.length > 0) {
            throw new AppError(
              errors.INVALID_TASK_STATUS.message,
              errors.INVALID_TASK_STATUS.code,
              errors.INVALID_TASK_STATUS.errorCode,
              errors.INVALID_TASK_STATUS.suggestion,
            );
          }
          task.completedAt = new Date();
        }
      }
    }

    // Assignment of a task to a user validation
    if (updates.assignedTo) {
      // Check the user existence and if the user is a team member of the project
      const membership = await TeamMember.findOne({
        userId: updates.assignedTo,
        teamId: project.team_id,
      });

      if (!membership) {
        throw new AppError(
          commonErrors.USER_NOT_FOUND.message,
          commonErrors.USER_NOT_FOUND.code,
          commonErrors.USER_NOT_FOUND.errorCode,
          commonErrors.USER_NOT_FOUND.suggestion,
        );
      }

      task.assignedTo = updates.assignedTo;
    }

    // Simple fields update (title, description, priority, story points, type)
    const simpleFields = [
      "title",
      "description",
      "priority",
      "storyPoints",
      "type",
      "startDate",
      "dueDate",
    ];

    simpleFields.forEach((field) => {
      if (updates[field] !== undefined) {
        task[field] = updates[field];
      }
    });

    // Save the changes
    await task.save();

    // Emit socket event for real-time update
    const io = req.app.get("io");
    if (io) {
      io.emit("taskUpdated", { projectId: task.projectId, task });
    }

    res.status(200).json({
      status: "Success",
      message: "Task updated successfully!",
      task,
    });
  } catch (err) {
    next(err);
  }
};

// Delete a task (Product owner only)
export const deleteTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { id: userId } = req.user;

    // Check the task existence
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError(
        errors.TASK_NOT_FOUND.message,
        errors.TASK_NOT_FOUND.code,
        errors.TASK_NOT_FOUND.errorCode,
        errors.TASK_NOT_FOUND.suggestion,
      );
    }

    // Check the project existence
    const project = await Project.findById(task.projectId);
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

    // Authorization Check: Only the product owner of the project can delete a task
    if (project.productOwnerId.toString() !== userId.toString()) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_DELETE_PROJECT_TASKS.message,
        errors.UNAUTHORIZED_TO_DELETE_PROJECT_TASKS.code,
        errors.UNAUTHORIZED_TO_DELETE_PROJECT_TASKS.errorCode,
        errors.UNAUTHORIZED_TO_DELETE_PROJECT_TASKS.suggestion,
      );
    }

    // STATUS RULE: You cannot delete a task that is In Progress or in Review
    const nonDeletableStatuses = ["In Progress", "Review"];
    if (nonDeletableStatuses.includes(task.status)) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_DELETE_PROJECT_TASKS.message,
        errors.UNAUTHORIZED_TO_DELETE_PROJECT_TASKS.code,
        errors.UNAUTHORIZED_TO_DELETE_PROJECT_TASKS.errorCode,
        errors.UNAUTHORIZED_TO_DELETE_PROJECT_TASKS.suggestion,
      );
    }

    // SUB-TASKS STATUS RULE: Check the sub-tasks status
    const invalidSubtask = await Task.exists({
      parentTaskId: taskId,
      status: { $in: ["In Progress", "Review"] },
    });

    if (invalidSubtask) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_DELETE_PROJECT_TASKS.message,
        errors.UNAUTHORIZED_TO_DELETE_PROJECT_TASKS.code,
        errors.UNAUTHORIZED_TO_DELETE_PROJECT_TASKS.errorCode,
        errors.UNAUTHORIZED_TO_DELETE_PROJECT_TASKS.suggestion,
      );
    }

    // CASCADE DELETE
    await Task.deleteMany({ parentTaskId: taskId });
    await Task.findByIdAndDelete(taskId);

    // Emit socket event for real-time update
    const io = req.app.get("io");
    if (io) {
      io.emit("taskDeleted", { projectId: task.projectId, taskId });
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Task and Its sub-tasks deleted successfully!",
    });
  } catch (err) {
    next(err);
  }
};

// Move a task to a different status (Kanban logic)
export const moveTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { status: rawStatus } = req.body;
    const status = normalizeStatus(rawStatus);

    // Check the task existence
    const task = await Task.findById(taskId);
    if (!task)
      throw new AppError(
        errors.TASK_NOT_FOUND.message,
        errors.TASK_NOT_FOUND.code,
        errors.TASK_NOT_FOUND.errorCode,
        errors.TASK_NOT_FOUND.suggestion,
      );

    // Check the project existence
    const project = await Project.findById(task.projectId);
    if (!project)
      throw new AppError(
        projectErrors.PROJECT_NOT_FOUND.message,
        projectErrors.PROJECT_NOT_FOUND.code,
        projectErrors.PROJECT_NOT_FOUND.errorCode,
        projectErrors.PROJECT_NOT_FOUND.suggestion,
      );

    // Check if the project is archived, completed or on hold
    isProjectInactive(project);

    // Check user authorization: Product owner of the project + Team members of the project can move a task
    const { id: userId } = req.user;
    const isProductOwner =
      project.productOwnerId.toString() === userId.toString();
    const isMember = await TeamMember.exists({
      userId,
      teamId: project.team_id,
    });

    if (!isProductOwner && !isMember) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_MOVE_PROJECT_TASKS.message,
        errors.UNAUTHORIZED_TO_MOVE_PROJECT_TASKS.code,
        errors.UNAUTHORIZED_TO_MOVE_PROJECT_TASKS.errorCode,
        errors.UNAUTHORIZED_TO_MOVE_PROJECT_TASKS.suggestion,
      );
    }

    if (status) {
      const validStatuses = Task.schema.path("status").enumValues;
      if (!validStatuses.includes(status)) {
        throw new AppError(
          errors.INVALID_TASK_STATUS.message,
          errors.INVALID_TASK_STATUS.code,
          errors.INVALID_TASK_STATUS.errorCode,
          errors.INVALID_TASK_STATUS.suggestion,
        );
      }

      // Prevent a task from leaving backlog without being assigned to a sprint
      if (!task.sprintId && status !== "Backlog") {
        throw new AppError(
          errors.TASK_WITHOUT_SPRINT.message,
          errors.TASK_WITHOUT_SPRINT.code,
          errors.TASK_WITHOUT_SPRINT.errorCode,
          errors.TASK_WITHOUT_SPRINT.suggestion,
        );
      }

      task.status = status;
      task.completedAt = status === "Done" ? new Date() : null;
    }

    // Save the changes
    await task.save();

    // Emit socket event for real-time update
    const io = req.app.get("io");
    if (io) {
      io.emit("taskUpdated", { projectId: String(task.projectId), task });
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Task moved successfully!",
      data: task,
    });
  } catch (err) {
    next(err);
  }
};

// Submit a task (Only the assigned user)
export const submitTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { type, linkUrl, comment, summary, completionRate, hoursSpent } =
      req.body;

    const parsedCompletionRate = completionRate !== undefined && completionRate !== "" 
      ? Number(completionRate) 
      : undefined;
    const parsedHoursSpent = hoursSpent !== undefined && hoursSpent !== "" 
      ? Number(hoursSpent) 
      : undefined;

    // Check the task existence
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError(
        errors.TASK_NOT_FOUND.message,
        errors.TASK_NOT_FOUND.code,
        errors.TASK_NOT_FOUND.errorCode,
        errors.TASK_NOT_FOUND.suggestion,
      );
    }

    // Check the project existence
    const project = await Project.findById(task.projectId);
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

    // Authorization check: Only the assigned user can submit the task
    const { id: userId } = req.user;
    if (!task.assignedTo || task.assignedTo.toString() !== userId.toString()) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_SUBMIT_TASK.message,
        errors.UNAUTHORIZED_TO_SUBMIT_TASK.code,
        errors.UNAUTHORIZED_TO_SUBMIT_TASK.errorCode,
        errors.UNAUTHORIZED_TO_SUBMIT_TASK.suggestion,
      );
    }

    // Status validation
    if (!["In Progress", "Review"].includes(task.status)) {
      throw new AppError(
        errors.TASK_NOT_IN_PROGRESS_OR_REVIEW.message,
        errors.TASK_NOT_IN_PROGRESS_OR_REVIEW.code,
        errors.TASK_NOT_IN_PROGRESS_OR_REVIEW.errorCode,
        errors.TASK_NOT_IN_PROGRESS_OR_REVIEW.suggestion,
      );
    }

    // Check the sprint state
    let sprintClosed = false;
    if (task.sprintId) {
      const sprint = await Sprint.findById(task.sprintId);

      if (sprint && sprint.status === "Completed") {
        sprintClosed = true;
      }
    }

    let finalUrl = "";
    let publicId = null;

    // CASE 1: FILE SUBMISSION
    if (type === "file") {
      if (!req.file) {
        throw new AppError(
          commonErrors.NO_FILE_UPLOADED.message,
          commonErrors.NO_FILE_UPLOADED.code,
          commonErrors.NO_FILE_UPLOADED.errorCode,
          commonErrors.NO_FILE_UPLOADED.suggestion,
        );
      }

      const result = await uploadDocToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "hrcom/task_submissions",
      );

      finalUrl = result.secure_url;
      publicId = result.public_id;
    }

    // CASE 2: LINK SUBMISSION
    else if (type === "link") {
      if (!linkUrl) {
        throw new AppError(
          errors.LINK_REQUIRED.message,
          errors.LINK_REQUIRED.code,
          errors.LINK_REQUIRED.errorCode,
          errors.LINK_REQUIRED.suggestion,
        );
      }

      finalUrl = linkUrl;
    } else {
      throw new AppError(
        errors.INVALID_SUBMISSION_TYPE.message,
        errors.INVALID_SUBMISSION_TYPE.code,
        errors.INVALID_SUBMISSION_TYPE.errorCode,
        errors.INVALID_SUBMISSION_TYPE.suggestion,
      );
    }

    // Detect the late submission
    const isLate = task.sprintId && sprintClosed;

    // Validate the task summary submission
    if (!summary) {
      throw new AppError(
        errors.SUMMARY_REQUIRED.message,
        errors.SUMMARY_REQUIRED.code,
        errors.SUMMARY_REQUIRED.errorCode,
        errors.SUMMARY_REQUIRED.suggestion,
      );
    }

    // Validate the completion rate
    if ( parsedCompletionRate !== undefined &&
      (typeof parsedCompletionRate !== "number" ||
      isNaN(parsedCompletionRate) ||
      parsedCompletionRate < 0 ||
      parsedCompletionRate > 100
      )
    ) {
      throw new AppError(
        errors.INVALID_COMPLETION_RATE.message,
        errors.INVALID_COMPLETION_RATE.code,
        errors.INVALID_COMPLETION_RATE.errorCode,
        errors.INVALID_COMPLETION_RATE.suggestion,
      );
    }

    // Validate the hours spent
    if (parsedHoursSpent !== undefined && (typeof parsedHoursSpent !== "number" || isNaN(parsedHoursSpent) || parsedHoursSpent < 0)) {
      throw new AppError(
        errors.INVALID_HOURS_SPENT.message,
        errors.INVALID_HOURS_SPENT.code,
        errors.INVALID_HOURS_SPENT.errorCode,
        errors.INVALID_HOURS_SPENT.suggestion,
      );
    }

    // Save submission
    task.submission = {
      summary,
      type,
      linkUrl: finalUrl,
      linkPublicId: publicId,
      submittedAt: new Date(),
      comment: comment || "",
      completionRate: parsedCompletionRate || 0,
      hoursSpent: parsedHoursSpent || 0,
    };

    // Move the task to Review automatically
    if (task.status === "In Progress") {
      task.status = "Review";
    }

    task.isSubmittedAfterSprintEnd = isLate;
    task.sprintClosedAtSubmission = sprintClosed;

    await task.save();

    // Re-fetch to get populated fields for the real-time update
    const savedTask = await Task.findById(task._id)
      .populate("assignedTo", "name lastName profileImageURL")
      .lean();

    // Emit socket event for real-time update
    const io = req.app.get("io");
    if (io) {
      io.emit("taskUpdated", { 
        projectId: String(savedTask.projectId), 
        task: { ...savedTask, id: savedTask._id } 
      });
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Task submitted successfully!",
      data: {
        task,
        flags: {
          isLateSubmission: isLate,
          sprintAlreadyClosed: sprintClosed,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// Unsubmit a task (Only the assigned user)
export const unSubmitTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    // Check the task existence
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError(
        errors.TASK_NOT_FOUND.message,
        errors.TASK_NOT_FOUND.code,
        errors.TASK_NOT_FOUND.errorCode,
        errors.TASK_NOT_FOUND.suggestion,
      );
    }

    // Check the project existence
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError(
        projectErrors.PROJECT_NOT_FOUND.message,
        projectErrors.PROJECT_NOT_FOUND.code,
        projectErrors.PROJECT_NOT_FOUND.errorCode,
        projectErrors.PROJECT_NOT_FOUND.suggestion,
      );
    }

    // Check if the project is archived, completed or on hold
    isProjectInactive(project)

    // Only the assigned user can remove his submission
    const { id: userId } = req.user;

    if (!task.assignedTo || task.assignedTo.toString() !== userId.toString()) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_UNSUBMIT_TASK.message,
        errors.UNAUTHORIZED_TO_UNSUBMIT_TASK.code,
        errors.UNAUTHORIZED_TO_UNSUBMIT_TASK.errorCode,
        errors.UNAUTHORIZED_TO_UNSUBMIT_TASK.suggestion,
      );
    }

    // Check if submission exists
    if (!task.submission || task.submission.type === "none") {
      throw new AppError(
        errors.NO_SUBMISSION_TO_DELETE.message,
        errors.NO_SUBMISSION_TO_DELETE.code,
        errors.NO_SUBMISSION_TO_DELETE.errorCode,
        errors.NO_SUBMISSION_TO_DELETE.suggestion,
      );
    }

    // If it's a file, delete it from Cloudinary
    if (task.submission.type === "file" && task.submission.linkPublicId) {
      await deleteFromCloudinary(task.submission.linkPublicId, "raw");
    }

    // Clear the submission
    task.submission = {
      type: "none",
      linkUrl: "",
      summary: "",
      linkPublicId: null,
      submittedAt: null,
      comment: "",
      completionRate: 0,
      hoursSpent: 0,
    };

    // Move back the task to "In Progress" (If it was in Review) automatically
    if (task.status === "Review") {
      task.status = "In Progress";
      task.completedAt = null;
    }

    // Save the changes
    await task.save();

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Task submission removed successfully!",
      data: task,
    });
  } catch (err) {
    next(err);
  }
};

// Assign / Reassign Task (Supervisor only)
export const assignTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      throw new AppError(
        errors.ASSIGNED_TEAM_MEMBER_REQUIRED.message,
        errors.ASSIGNED_TEAM_MEMBER_REQUIRED.code,
        errors.ASSIGNED_TEAM_MEMBER_REQUIRED.errorCode,
        errors.ASSIGNED_TEAM_MEMBER_REQUIRED.suggestion,
      );
    }

    // Check task existence
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError(
        errors.TASK_NOT_FOUND.message,
        errors.TASK_NOT_FOUND.code,
        errors.TASK_NOT_FOUND.errorCode,
        errors.TASK_NOT_FOUND.suggestion,
      );
    }

    // Check project existence
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError(
        projectErrors.PROJECT_NOT_FOUND.message,
        projectErrors.PROJECT_NOT_FOUND.code,
        projectErrors.PROJECT_NOT_FOUND.errorCode,
        projectErrors.PROJECT_NOT_FOUND.suggestion,
      );
    }

    // Check if the project is archived, completed or on hold
    isProjectInactive(project)

    // Check if the assigned user is in team
    const isMember = await TeamMember.findOne({
      userId: assignedTo,
      teamId: project.team_id,
    });
    if (!isMember) {
      throw new AppError(
        teamErrors.TEAM_MEMBER_NOT_AUTHORIZED.message,
        teamErrors.TEAM_MEMBER_NOT_AUTHORIZED.code,
        teamErrors.TEAM_MEMBER_NOT_AUTHORIZED.errorCode,
        teamErrors.TEAM_MEMBER_NOT_AUTHORIZED.suggestion,
      );
    }

    // Assign / Reassign the task
    const previousAssignee = task.assignedTo;
    task.assignedTo = assignedTo;
    await task.save();

    // If it's a parent task, we also update the assignedTo field of its sub-tasks
    let updatedSubTasks = [];
    if (!task.parentTaskId) {
      updatedSubTasks = await Task.updateMany(
        { parentTaskId: task._id },
        { assignedTo },
      );
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: previousAssignee
        ? "Task reassigned successfully!"
        : "Task assigned successfully!",
      data: {
        task,
        updatedSubTasks: updatedSubTasks.modifiedCount || 0,
      }
    });
  } catch (err) {
    next(err);
  }
};

// Review / Validate Task (Supervisor only - Product Owner of the project)
export const reviewTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { action, feedback } = req.body;

    if (!["approve", "reject"].includes(action)) {
      throw new AppError(
        errors.INVALID_REVIEW_ACTION.message,
        errors.INVALID_REVIEW_ACTION.code,
        errors.INVALID_REVIEW_ACTION.errorCode,
        errors.INVALID_REVIEW_ACTION.suggestion,
      );
    }

    // Check task existence
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError(
        errors.TASK_NOT_FOUND.message,
        errors.TASK_NOT_FOUND.code,
        errors.TASK_NOT_FOUND.errorCode,
        errors.TASK_NOT_FOUND.suggestion,
      );
    }

    // Check the project existance
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError(
        projectErrors.PROJECT_NOT_FOUND.message,
        projectErrors.PROJECT_NOT_FOUND.code,
        projectErrors.PROJECT_NOT_FOUND.errorCode,
        projectErrors.PROJECT_NOT_FOUND.suggestion,
      );
    }

    // Check if the project is archived, completed or on hold
    isProjectInactive(project)

    // The Task must be in Review
    if (task.status !== "Review") {
      throw new AppError(
        errors.TASK_NOT_IN_REVIEW.message,
        errors.TASK_NOT_IN_REVIEW.code,
        errors.TASK_NOT_IN_REVIEW.errorCode,
        errors.TASK_NOT_IN_REVIEW.suggestion,
      );
    }

    // Check if there is a submission to review
    if (!task.submission || task.submission.type === "none") {
      throw new AppError(
        errors.NO_TASK_SUBMISSION_FOUND.message,
        errors.NO_TASK_SUBMISSION_FOUND.code,
        errors.NO_TASK_SUBMISSION_FOUND.errorCode,
        errors.NO_TASK_SUBMISSION_FOUND.suggestion,
      );
    }

    // Authorization check (Product owner only)
    const { id: userId } = req.user;
    if (project.productOwnerId.toString() !== userId.toString()) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_REVIEW_TASKS.message,
        errors.UNAUTHORIZED_TO_REVIEW_TASKS.code,
        errors.UNAUTHORIZED_TO_REVIEW_TASKS.errorCode,
        errors.UNAUTHORIZED_TO_REVIEW_TASKS.suggestion,
      );
    }

    // Approve the task
    if (action === "approve") {
      task.status = "Done";
      task.completedAt = new Date();
    }

    // Reject the task
    if (action === "reject") {
      task.status = "In Progress";
      task.completedAt = null;
    }

    // Add task feedback as a comment if provided
    if (feedback) {
      task.comments.push({
        text: feedback,
        author: userId,
        createdAt: new Date(),
      });
    }

    // Save the changes
    await task.save();

    // Emit socket event for real-time update
    const io = req.app.get("io");
    if (io) {
      io.emit("taskUpdated", { projectId: String(task.projectId), task });
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message:
        action === "approve"
          ? "Task approved successfully!"
          : "Task rejected and sent back to In Progress!",
      data: task,
    });
  } catch (err) {
    next(err);
  }
};

// Consult a task submission
export const getTaskSubmission = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    // Check task existence
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError(
        errors.TASK_NOT_FOUND.message,
        errors.TASK_NOT_FOUND.code,
        errors.TASK_NOT_FOUND.errorCode,
        errors.TASK_NOT_FOUND.suggestion
      );
    }

    // Check project existence
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError(
        projectErrors.PROJECT_NOT_FOUND.message,
        projectErrors.PROJECT_NOT_FOUND.code,
        projectErrors.PROJECT_NOT_FOUND.errorCode,
        projectErrors.PROJECT_NOT_FOUND.suggestion
      );
    }

    // Authorization: Only the product owner and the assigned user can consult the task submission
    const userId = req.user.id;
    const isAssigned = task.assignedTo?.toString() === userId.toString();
    const isPO = project.productOwnerId.toString() === userId.toString();

    if (!isAssigned && !isPO) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_VIEW_SUBMISSION.message,
        errors.UNAUTHORIZED_TO_VIEW_SUBMISSION.code,
        errors.UNAUTHORIZED_TO_VIEW_SUBMISSION.errorCode,
        errors.UNAUTHORIZED_TO_VIEW_SUBMISSION.suggestion
      );
    }

    if (!task.submission || task.submission.type === "none") {
      throw new AppError(
        errors.NO_TASK_SUBMISSION_FOUND.message,
        errors.NO_TASK_SUBMISSION_FOUND.code,
        errors.NO_TASK_SUBMISSION_FOUND.errorCode,
        errors.NO_TASK_SUBMISSION_FOUND.suggestion
      );
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Task submission retrieved successfully!",
      data: task.submission.linkUrl,
    });
  } catch (err) {
    next(err);
  }
};

// Download a task submission file
export const downloadTaskSubmission = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    // Check task existence
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError(
        errors.TASK_NOT_FOUND.message,
        errors.TASK_NOT_FOUND.code,
        errors.TASK_NOT_FOUND.errorCode,
        errors.TASK_NOT_FOUND.suggestion
      );
    }

    // Check project existence
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError(
        projectErrors.PROJECT_NOT_FOUND.message,
        projectErrors.PROJECT_NOT_FOUND.code,
        projectErrors.PROJECT_NOT_FOUND.errorCode,
        projectErrors.PROJECT_NOT_FOUND.suggestion
      );
    }

    // Authorization
    const isAssigned =
      task.assignedTo?.toString() === userId.toString();

    const isPO =
      project.productOwnerId?.toString() === userId.toString();

    if (!isAssigned && !isPO) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_DOWNLOAD_SUBMISSION.message,
        errors.UNAUTHORIZED_TO_DOWNLOAD_SUBMISSION.code,
        errors.UNAUTHORIZED_TO_DOWNLOAD_SUBMISSION.errorCode,
        errors.UNAUTHORIZED_TO_DOWNLOAD_SUBMISSION.suggestion
      );
    }

    // Check the task submission existence
    if (!task.submission || task.submission.type === "none") {
      throw new AppError(
        errors.NO_TASK_SUBMISSION_FOUND.message,
        errors.NO_TASK_SUBMISSION_FOUND.code,
        errors.NO_TASK_SUBMISSION_FOUND.errorCode,
        errors.NO_TASK_SUBMISSION_FOUND.suggestion
      );
    }

    // Handle the link submission
    if (task.submission.type === "link") {
      return res.status(200).json({
        status: "Success",
        code: 200,
        message: "Submission link retrieved successfully",
        data: {
          url: task.submission.linkUrl,
        },
      });
    }

    // Handle the file submission
    if (task.submission.type === "file") {
      return res.redirect(task.submission.linkUrl);
    }

    // In case of an invalid submission type
    throw new AppError(
      errors.INVALID_SUBMISSION_TYPE.message,
      errors.INVALID_SUBMISSION_TYPE.code,
      errors.INVALID_SUBMISSION_TYPE.errorCode,
      errors.INVALID_SUBMISSION_TYPE.suggestion
    );
  } catch (err) {
    next(err);
  }
};
