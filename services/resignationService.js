import User from "../models/User.js";
import Resignation from "../models/Resignation.js";
import Task from "../models/Task.js";
import { getOne, getAll, createOne } from "./handlersFactory.js";
import { errors } from "../errors/resignationErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import AppError from "../utils/AppError.js";
import { isEmpty } from "../validators/userValidators.js";
import { validateUserStatus } from "../validators/authValidators.js";
import { logAuditAction } from "../utils/logger.js";
import { refreshExitSummary } from "../utils/resignationHelpers.js";
import { createNotification } from "./notificationService.js";
import { createNotificationForAdmins } from "../utils/notificationHelpers.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";
import { markPayrollDirty } from "../utils/payrollHelpers.js";

// Get the resignation request statuses
export const getResignationStatuses = () => {
  const statuses = Resignation.schema.path("status").enumValues;

  return {
    status: "Success",
    code: 200,
    message: "Resignation statuses retrieved successfully!",
    data: statuses,
  };
};

// Get a single resignation request by ID (Admin + Employee who submitted it only)
export const getResignationById = async (resignationId, user) => {
  // Check the resignation existence
  const resignation = await Resignation.findById(resignationId);
  if (!resignation) {
    throw new AppError(
      errors.RESIGNATION_REQUEST_NOT_FOUND.message,
      errors.RESIGNATION_REQUEST_NOT_FOUND.code,
      errors.RESIGNATION_REQUEST_NOT_FOUND.errorCode,
      errors.RESIGNATION_REQUEST_NOT_FOUND.suggestion,
    );
  }

  // Authorization check: Only the employee who submitted the resignation or Admin can access it
  if (
    resignation.employeeId.toString() !== user.id.toString() &&
    user.role !== "Admin"
  ) {
    throw new AppError(
      "You are not authorized to view this resignation request.",
      errors.UNAUTHORIZED_ACTION.code,
      errors.UNAUTHORIZED_ACTION.errorCode,
      "Only the employee who submitted the resignation or an Admin can access it.",
    );
  }

  const refreshed = await refreshExitSummary(resignation);

  return {
    status: "Success",
    code: 200,
    message: "Resignation retrieved successfully!",
    data: refreshed,
  };
};

// Get all resignation requests (Admin only)
export const getAllResignations = async (queryParams) => {
  const finalQuery = {
    ...queryParams,
    limit: 5,
    sort: "createdAt",
  };
  return await getAll(
    Resignation,
    { path: "employeeId", select: "profileImageURL" },
    null,
    ["employeeSnapshot.name"],
  )(finalQuery);
};

// Get the current user's own resignation request
export const getMyResignation = async (userId) => {
  const resignation = await Resignation.findOne({
    employeeId: userId,
    status: {
      $in: [
        "submitted",
        "clarification_requested",
        "approved",
        "scheduled_exit",
      ],
    },
  }).sort({ createdAt: -1 });

  const refreshed = await refreshExitSummary(resignation);

  return {
    status: "Success",
    code: 200,
    message: refreshed
      ? "Resignation retrieved successfully!"
      : "No active resignation found.",
    data: refreshed ?? null,
  };
};

// Submit a resignation request (Employee only: No Interns allowed)
export const submitResignation = async (employeeId, payload) => {
  const { reason } = payload;

  // Check the user existence
  const user = await User.findById(employeeId).populate("department_id");
  if (!user) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Check if the user is already inactive or even blocked
  validateUserStatus(user);

  // Prevent submitting multiple active resignations
  const existing = await Resignation.findOne({
    employeeId,
    status: {
      $in: [
        "submitted",
        "clarification_requested",
        "approved",
        "scheduled_exit",
      ],
    },
  });
  if (existing) {
    throw new AppError(
      errors.RESIGNATION_ALREADY_EXISTS.message,
      errors.RESIGNATION_ALREADY_EXISTS.code,
      errors.RESIGNATION_ALREADY_EXISTS.errorCode,
      errors.RESIGNATION_ALREADY_EXISTS.suggestion,
    );
  }

  // Validate the reason for resignation
  if (isEmpty(reason)) {
    throw new AppError(
      errors.INVALID_RESIGNATION_REASON.message,
      errors.INVALID_RESIGNATION_REASON.code,
      errors.INVALID_RESIGNATION_REASON.errorCode,
      errors.INVALID_RESIGNATION_REASON.suggestion,
    );
  }

  // Build the employee snapshot
  const employeeSnapshot = {
    name: user.name,
    email: user.email,
    department: user.department_id.name,
    position: user.position,
  };

  // Create the resignation request
  const resignationData = {
    employeeId,
    employeeSnapshot,
    reason,
    submissionDate: new Date(),
    status: "submitted",
  };

  const resignation = await createOne(Resignation)(resignationData);

  // Send a notification for all admin users about the resignation submitted
  try {
    await createNotificationForAdmins({
      type: "RESIGNATION",
      title: "New Resignation Submitted",
      message: `${user.name} ${user.lastName} has submitted a resignation request.`,
      data: {
        entityType: "USER",
        entityId: user._id,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for the resignation submission:",
      err,
    );
  }

  return resignation;
};

// Update a resignation request (Employee only)
export const updateResignation = async (resignationId, employeeId, payload) => {
  const { reason } = payload;

  // Check the resignation request existence
  const resignation = await Resignation.findById(resignationId);
  if (!resignation) {
    throw new AppError(
      errors.RESIGNATION_REQUEST_NOT_FOUND.message,
      errors.RESIGNATION_REQUEST_NOT_FOUND.code,
      errors.RESIGNATION_REQUEST_NOT_FOUND.errorCode,
      errors.RESIGNATION_REQUEST_NOT_FOUND.suggestion,
    );
  }

  // Authorization check: Only the employee who submitted the resignation can update it
  if (resignation.employeeId.toString() !== employeeId.toString()) {
    throw new AppError(
      "You are not authorized to update this resignation request.",
      errors.UNAUTHORIZED_ACTION.code,
      errors.UNAUTHORIZED_ACTION.errorCode,
      "Only the employee who submitted the resignation request can update it.",
    );
  }

  // Status restriction: You can only update the resignation request if its status is still "submitted"
  if (resignation.status !== "submitted") {
    throw new AppError(
      errors.INVALID_STATUS_UPDATE.message,
      errors.INVALID_STATUS_UPDATE.code,
      errors.INVALID_STATUS_UPDATE.errorCode,
      errors.INVALID_STATUS_UPDATE.suggestion,
    );
  }

  // Validate the reason
  if (reason !== undefined && isEmpty(reason)) {
    throw new AppError(
      errors.INVALID_RESIGNATION_REASON.message,
      errors.INVALID_RESIGNATION_REASON.code,
      errors.INVALID_RESIGNATION_REASON.errorCode,
      errors.INVALID_RESIGNATION_REASON.suggestion,
    );
  } else {
    resignation.reason = reason;
  }

  // Save the changes
  await resignation.save();

  return {
    status: "Success",
    code: 200,
    message: "Resignation updated successfully!",
    data: resignation,
  };
};

// Request clarification on a resignation (Admin only)
export const requestClarification = async (
  resignationId,
  adminId,
  payload,
  ip,
) => {
  const { message } = payload;

  // Check the admin existence
  const admin = await User.findById(adminId);
  if (!admin) {
    throw new AppError(
      "Admin not found.",
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      "Please provide a valid admin ID to proceed with the clarification request.",
    );
  }

  // Validate the clarification message
  if (isEmpty(message)) {
    throw new AppError(
      errors.INVALID_CLARIFICATION_MESSAGE.message,
      errors.INVALID_CLARIFICATION_MESSAGE.code,
      errors.INVALID_CLARIFICATION_MESSAGE.errorCode,
      errors.INVALID_CLARIFICATION_MESSAGE.suggestion,
    );
  }

  // Atomic update on the resignation request
  const updated = await Resignation.findOneAndUpdate(
    {
      _id: resignationId,
      status: "submitted",
      clarificationMessage: null,
    },
    {
      status: "clarification_requested",
      clarificationMessage: message,
      clarification: {
        requestedBy: adminId,
        requestedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  // If resignation not found, already processed by another admin
  if (!updated) {
    throw new AppError(
      errors.RESIGNATION_ALREADY_PROCESSED.message,
      errors.RESIGNATION_ALREADY_PROCESSED.code,
      errors.RESIGNATION_ALREADY_PROCESSED.errorCode,
      errors.RESIGNATION_ALREADY_PROCESSED.suggestion,
    );
  }

  // Get the employee details for logging purposes
  const employee = await User.findById(updated.employeeId).select(
    "name lastName",
  );
  if (!employee) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Create the audit log for this action
  await logAuditAction({
    adminId: adminId,
    action: "REQUEST_CLARIFICATION",
    targetType: "Resignation",
    targetId: updated.employeeId,
    targetName: `${employee.name} ${employee.lastName}`,
    details: updated,
    ipAddress: ip,
  });

  // Send a notification to the employee about the clarification request
  try {
    await createNotification({
      recipientId: employee._id,
      type: "RESIGNATION",
      title: "Clarification Requested",
      message:
        "Your resignation request requires clarification. Please provide more information.",
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for the resignation clarification request:",
      err,
    );
  }

  // Notify all admins except the one who requested the clarification
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: adminId,
      type: "RESIGNATION",
      title: "Resignation Clarification Requested",
      message: `${employee.name} ${employee.lastName}'s resignation has been submitted for clarification.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send admin notification for resignation clarification submission:",
      err,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Clarification requested successfully!",
    data: updated,
  };
};

// Respond to a clarification request
export const respondToClarification = async (
  resignationId,
  employeeId,
  payload,
) => {
  const { response } = payload;

  // Validate response
  if (isEmpty(response)) {
    throw new AppError(
      errors.INVALID_CLARIFICATION_RESPONSE.message,
      errors.INVALID_CLARIFICATION_RESPONSE.code,
      errors.INVALID_CLARIFICATION_RESPONSE.errorCode,
      errors.INVALID_CLARIFICATION_RESPONSE.suggestion,
    );
  }

  // Atomic update
  const updated = await Resignation.findOneAndUpdate(
    {
      _id: resignationId,
      employeeId,
      status: "clarification_requested",
    },
    {
      clarificationResponse: response,
      status: "submitted",
    },
    { returnDocument: "after" },
  );

  if (!updated) {
    throw new AppError(
      errors.RESIGNATION_ALREADY_PROCESSED.message,
      errors.RESIGNATION_ALREADY_PROCESSED.code,
      errors.RESIGNATION_ALREADY_PROCESSED.errorCode,
      errors.RESIGNATION_ALREADY_PROCESSED.suggestion,
    );
  }

  // Get the employee details for notification purposes
  const employee = await User.findById(employeeId).select("name lastName");

  // Send a notification for all admin users about the clarification response
  try {
    await createNotificationForAdmins({
      type: "RESIGNATION",
      title: "New Clarification Response",
      message: `${employee.name} ${employee.lastName} has submitted a clarification response.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for the clarification response:",
      err,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Clarification response submitted successfully!",
    data: updated,
  };
};

// Approve a resignation request (Admin Only)
export const approveResignation = async (resignationId, weeksNotice, currentUser, ip) => {
  // Calculate exit date first
  const exitDate = new Date();
  exitDate.setDate(exitDate.getDate() + weeksNotice);

  // update the resignation request
  let updated = await Resignation.findOneAndUpdate(
    {
      _id: resignationId,
      status: "submitted",
    },
    {
      status: "approved",
      exitDate,
      approval: {
        processedBy: currentUser.id,
        processedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  // If update doesn't exist, it's already processed by another admin
  if (!updated) {
    throw new AppError(
      errors.RESIGNATION_ALREADY_PROCESSED.message,
      errors.RESIGNATION_ALREADY_PROCESSED.code,
      errors.RESIGNATION_ALREADY_PROCESSED.errorCode,
      errors.RESIGNATION_ALREADY_PROCESSED.suggestion,
    );
  }

  updated = await refreshExitSummary(updated);

  await updated.save();

  // Mark the payroll as dirty to trigger a recomputation with the resignation impact
  await markPayrollDirty(
    updated.employeeId,
    updated.exitDate,
    "Employee resignation approved",
  );

  // Get the employee details for logging purposes
  const employee = await User.findById(updated.employeeId).select(
    "name lastName",
  );
  if (!employee) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Create the audit log for this action
  await logAuditAction({
    adminId: currentUser.id,
    action: "APPROVE_RESIGNATION",
    targetType: "Resignation",
    targetId: updated.employeeId,
    targetName: `${employee.name} ${employee.lastName}`,
    details: updated,
    ipAddress: ip,
  });

  // Send a notification to the employee about the resignation approval
  try {
    await createNotification({
      recipientId: employee._id,
      type: "RESIGNATION",
      title: "Resignation Approved",
      message: "Your resignation request has been approved.",
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for the resignation approval:",
      err,
    );
  }

  // Notify all admins except the one who approved the resignation
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: currentUser.id,
      type: "RESIGNATION",
      title: "Resignation Approved",
      message: `${employee.name} ${employee.lastName}'s resignation has been approved.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send admin notification for resignation approval:",
      err,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Resignation approved successfully!",
    data: updated,
  };
};

// Start the exit process of a user (Admin Only)
export const startExitProcess = async (resignationId, currentUser, ip) => {
  // Update the resignation status to "scheduled_exit" from "approved" to prevent
  const updated = await Resignation.findOneAndUpdate(
    {
      _id: resignationId,
      status: "approved",
    },
    {
      status: "scheduled_exit",
      startedExitProcessAt: new Date(),
    },
    { returnDocument: "after" },
  );

  if (!updated) {
    throw new AppError(
      "Resignation must be approved before starting the exit process.",
      errors.INVALID_STATUS_UPDATE.code,
      errors.INVALID_STATUS_UPDATE.errorCode,
      "Please approve the resignation first.",
    );
  }

  // Check the employee existence
  const employee = await User.findById(updated.employeeId).select(
    "name lastName",
  );
  if (!employee) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  await logAuditAction({
    adminId: currentUser.id,
    action: "START_EXIT_PROCESS",
    targetType: "Resignation",
    targetId: updated.employeeId,
    targetName: `${employee.name} ${employee.lastName}`,
    details: updated,
    ipAddress: ip,
  });

  // Send a notification to the employee about the resignation approval
  try {
    await createNotification({
      recipientId: employee._id,
      type: "RESIGNATION",
      title: "Resignation Exit Process Started",
      message: "The exit process regarding your resignation has started.",
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for the resignation exit process:",
      err,
    );
  }

  // Notify all admins except the one who approved the resignation
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: currentUser.id,
      type: "RESIGNATION",
      title: "Resignation Exit Process Started",
      message: `${employee.name} ${employee.lastName}'s resignation exit process has started.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send admin notification for resignation exit process:",
      err,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Exit process started successfully!",
    data: updated,
  };
};
