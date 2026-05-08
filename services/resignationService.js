import User from "../models/User.js";
import Resignation from "../models/Resignation.js";
import Task from "../models/Task.js";
import Payroll from "../models/Payroll.js";
import { getOne, getAll, createOne } from "./handlersFactory.js";
import { errors } from "../errors/resignationErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import AppError from "../utils/AppError.js";
import { isEmpty } from "../validators/userValidators.js";
import { validateUserStatus } from "../validators/authValidators.js";
import { logAuditAction } from "../utils/logger.js"; // For logging resignation-related actions in the audit logs
import { markPayrollDirty } from "../utils/payrollHelpers.js"; // To mark payroll as dirty for recalculation when a resignation is approved

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

  return await getOne(
    Resignation,
    errors.RESIGNATION_REQUEST_NOT_FOUND,
  )(resignationId);
};

// Get all resignation requests (Admin only)
export const getAllResignations = async (queryParams) => {
  const finalQuery = {
    ...queryParams,
    limit: 5,
    sort: "createdAt",
  };
  return await getAll(Resignation, null, null, ["employeeSnapshot.name"])(
    finalQuery,
  );
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

  // Calculate the last working date : Submission date + notice period (14 days by default)
  const lastWorkingDate = new Date();
  lastWorkingDate.setDate(lastWorkingDate.getDate() + 14);

  // Create the resignation request
  const resignationData = {
    employeeId,
    employeeSnapshot,
    reason,
    submissionDate: new Date(),
    lastWorkingDate,
    status: "submitted",
  };

  return await createOne(Resignation)(resignationData);
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

  return {
    status: "Success",
    code: 200,
    message: "Clarification response submitted successfully!",
    data: updated,
  };
};

// Approve a resignation request (Admin Only)
export const approveResignation = async (resignationId, adminId, ip) => {
  // Check the admin existence
  const admin = await User.findById(adminId);
  if (!admin) {
    throw new AppError(
      "Admin not found.",
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      "Please provide a valid admin ID to proceed with the resignation approval.",
    );
  }

  // Get the resignation request details to calculate the payroll impact
  const submissionDate = new Date(resignation.submissionDate);
  const payrollImpact = {
    from: new Date(submissionDate.getFullYear(), submissionDate.getMonth(), 1),
    to: resignation.lastWorkingDate,
  };

  // Atomic update to the resignation request
  const updated = await Resignation.findOneAndUpdate(
    {
      _id: resignationId,
      status: "submitted",
    },
    {
      status: "approved",
      approval: {
        processedBy: adminId,
        processedAt: new Date(),
      },
      payrollImpact,
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

  // Mark the payroll as dirty to trigger a recomputation with the resignation impact
  await markPayrollDirty(
    updated.employeeId,
    updated.lastWorkingDate,
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
    adminId: adminId,
    action: "APPROVE_RESIGNATION",
    targetType: "Resignation",
    targetId: updated.employeeId,
    targetName: `${employee.name} ${employee.lastName}`,
    details: updated,
    ipAddress: ip,
  });

  return {
    status: "Success",
    code: 200,
    message: "Resignation approved successfully!",
    data: updated,
  };
};

// Process the final settlement for a resignation
export const processFinalSettlementService = async (resignationId, adminId, ip) => {
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

  // Get the employee details for the final settlement calculation
  const employee = await User.findById(resignation.employeeId).populate(
    "leaveBalances",
  );

  // Calculate the final salary
  const payroll = await Payroll.findOne({
    employeeId: employee._id,
    month: resignation.lastWorkingDate.getMonth() + 1,
    year: resignation.lastWorkingDate.getFullYear(),
  });

  const finalSalary = payroll?.netSalary || 0;

  // Calculate the remaining leave balance
  const remainingLeaveBalance = employee.leaveBalances.reduce(
    (total, leave) => total + leave.remainingDays,
    0,
  );

  // Calculate the pending tasks at the time of resignation
  const pendingTasks = await Task.countDocuments({
    assignedTo: employee._id,
    status: { $ne: "Done" },
  });

  resignation.finalSettlement = {
    finalSalary,
    remainingLeaveBalance,
    pendingTasks,
  };

  await resignation.save();

  // Create the audit log for this action
  await logAuditAction({
    adminId: adminId,
    action: "PROCESS_FINAL_SETTLEMENT",
    targetType: "Resignation",
    targetId: employee._id,
    targetName: `${employee.name} ${employee.lastName}`,
    details: resignation.finalSettlement,
    ipAddress: ip,
  });
};
