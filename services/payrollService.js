import mongoose from "mongoose";
import User from "../models/User.js";
import Payroll from "../models/Payroll.js";
import PayrollConfig from "../models/PayrollConfig.js";
import UserRole from "../models/UserRole.js";
import { errors } from "../errors/payrollErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors as payrollConfigErrors } from "../errors/payrollConfigErrors.js";
import AppError from "../utils/AppError.js";
import {
  calculateProratedSalary,
  calculateOvertime,
  calculateAbsences,
  calculateLateDeduction,
  calculateUnpaidLeaveDeduction,
  calculateIRPPMonthly,
  calculateCSS,
  round,
  getHourlyRate,
  buildAllowancesSnapshot,
  buildBonusesSnapshot,
  canAccessPayroll,
  computePayroll,
  generatePayrollExcel,
  buildPayslipData,
} from "../utils/payrollHelpers.js";
import { getOne, getAll } from "./handlersFactory.js";
import { logAuditAction } from "../utils/logger.js";
import { generateDocumentService } from "./documentService.js";
import { validateUserStatus } from "../validators/authValidators.js";
import { createNotification } from "../services/notificationService.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";
import { uploadDocToCloudinary } from "../utils/cloudinaryHelper.js";

// Payroll calculation for an employee for a given month and year
export const calculatePayroll = async (employeeId, month, year, configDoc) => {
  // Check the employee existence and status
  const user = await User.findById(employeeId);
  if (!user) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  validateUserStatus(user);

  // Prevent duplicate payroll for the same employee and month
  const existing = await Payroll.findOne({ employeeId, month, year });
  if (existing) {
    throw new AppError(
      errors.PAYROLL_ALREADY_EXISTS.message,
      errors.PAYROLL_ALREADY_EXISTS.code,
      errors.PAYROLL_ALREADY_EXISTS.errorCode,
      errors.PAYROLL_ALREADY_EXISTS.suggestion,
    );
  }

  // Compute the payroll
  const computed = await computePayroll(user, month, year, configDoc);

  // Create payroll
  const payroll = await Payroll.create({
    employeeId,
    month,
    year,

    ...computed,

    configSnapshot: {
      year,
      cnss: configDoc.cnss,
      css: configDoc.css,
      irpp: configDoc.irpp,
      payroll: {
        standardMonthlyHours: configDoc.payroll.standardMonthlyHours,
      },
    },

    status: "draft",
  });

  return {
    status: "Success",
    code: 201,
    message: "Payroll calculated successfully!",
    data: payroll,
  };
};

// Wrapper service function to generate payroll for an employee with audit logging and notifications
export const generatePayrollForEmployee = async (
  employeeId,
  month,
  year,
  user,
  ip,
) => {
  // Get the active payroll configuration for the year
  const configDoc = await PayrollConfig.findOne({ year, isActive: true });
  if (!configDoc) {
    throw new AppError(
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.message,
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.code,
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.errorCode,
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.suggestion,
    );
  }

  // Calculate the employee's payroll for the given month and year
  const result = await calculatePayroll(employeeId, month, year, configDoc);

  const payroll = result.data;

  // Populate employee for notifications
  await payroll.populate({
    path: "employeeId",
    select: "name lastName",
  });

  const employee = payroll.employeeId;

  // Audit log the action of generating payroll for an employee
  await logAuditAction({
    adminId: user.id,
    action: "GENERATE_PAYROLL",
    targetType: "Payroll",
    targetId: payroll._id,
    targetName: `${employee.name} ${employee.lastName}`,
    details: {
      payroll,
    },
    ipAddress: ip,
  });

  // Notify the employee about the generated payroll
  try {
    await createNotification({
      recipientId: employee._id,
      type: "PAYROLL",
      title: "Payroll Generated",
      message: `Your ${month}/${year} payroll has been generated.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Payroll generation notification failed:", err.message);
  }

  // Notify all admins except the one who generated the payroll
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "PAYROLL",
      title: "Payroll Generated",
      message: `The payroll for ${employee.name} ${employee.lastName} for ${month}/${year} has been generated.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Payroll generation admin notification failed:", err.message);
  }

  return {
    status: "Success",
    code: 201,
    message: `Payroll generated for ${employee.name} ${employee.lastName} successfully!`,
    data: payroll,
  };
};

// Get a payroll record by ID
export const getPayrollById = async (id, user) => {
  // Get the payroll record with the employee details populated
  const result = await getOne(Payroll, errors.PAYROLL_NOT_FOUND, {
    path: "employeeId",
    select: "name lastName email position",
  })(id);

  const payroll = result.data;

  // Check if the requester is an admin or the owner of the payroll record
  canAccessPayroll(user, payroll.employeeId);

  return result;
};

// Get all payroll records
export const getAllPayrolls = getAll(Payroll, {
  path: "employeeId",
  select: "name lastName email position",
});

// Get an employee's payroll history
export const getEmployeePayrolls = async (user, queryParams) => {
  const isAdmin = user.role === "Admin";

  let finalQuery = {
    ...queryParams,
    status: { in: ["validated", "paid"] }, // We don't show payrolls until validated by the admin
  };

  // Enforce only the employee's own payroll records
  if (!isAdmin) {
    finalQuery.employeeId = user.id;
  }

  return await getAll(Payroll, {
    path: "employeeId",
    select: "name lastName email position",
  })(finalQuery);
};

// Validate a payroll (Admin only)
export const validatePayroll = async (payrollId, user, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payroll = await Payroll.findOneAndUpdate(
      {
        _id: payrollId,
        status: "draft",
      },
      {
        $set: {
          status: "validated",
          validatedBy: user.id,
          validatedAt: new Date(),
        },
      },
      {
        returnDocument: "after",
        session,
      },
    );

    if (!payroll) {
      throw new AppError(
        errors.PAYROLL_NOT_FOUND.message,
        errors.PAYROLL_NOT_FOUND.code,
        errors.PAYROLL_NOT_FOUND.errorCode,
        errors.PAYROLL_NOT_FOUND.suggestion,
      );
    }

    await session.commitTransaction();
    session.endSession();

    // Get the employee details for the audit log
    await payroll.populate({
      path: "employeeId",
      select: "name lastName email position department_id employment joinDate",
      populate: {
        path: "department_id",
        select: "name",
      },
    });

    const employee = payroll.employeeId;

    // Prepare the data for the payslip generation
    const payslipData = buildPayslipData(payroll, employee);

    // Generate the pdf payslip automatically
    await generateDocumentService({
      templateName: "monthly_payslip",
      data: {
        userId: employee._id,
        ...payslipData,
      },
      uploadedBy: user.id,
      ip,
    });

    // Create the audit log for this action
    await logAuditAction({
      adminId: user.id,
      action: "VALIDATE_PAYROLL",
      targetType: "Payroll",
      targetId: payroll.employeeId,
      targetName: `${employee.name} ${employee.lastName}`,
      details: payroll,
      ipAddress: ip,
    });

    // Send notification to the employee about the validated payroll
    try {
      await createNotification({
        recipientId: employee._id,
        type: "PAYROLL",
        title: "Payroll Validated",
        message: `Your ${payroll.month}/${payroll.year} payroll has been validated. Check the payroll section for details.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error("Failed to send notification for validated payroll:", err);
    }

    // Notify all admins except the one who validated the payroll
    try {
      await createNotificationForAdminsExcept({
        excludedUserId: user.id,
        type: "PAYROLL",
        title: "Payroll Validated",
        message: `The ${employee.name} ${employee.lastName} ${payroll.month}/${payroll.year}'s payroll has been validated.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error(
        "Failed to send admin notification for validated payroll:",
        err,
      );
    }

    return {
      status: "Success",
      code: 200,
      message: "Payroll validated successfully!",
      data: payroll,
    };
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}

    session.endSession();
    throw err;
  }
};

// Mark a payroll as paid (Admin only)
export const markPayrollAsPaid = async (payrollId, user, file, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  // Check the payment proof attachment existence
  if (!file) {
    throw new AppError(
      errors.PAYMENT_PROOF_REQUIRED.message,
      errors.PAYMENT_PROOF_REQUIRED.code,
      errors.PAYMENT_PROOF_REQUIRED.errorCode,
      errors.PAYMENT_PROOF_REQUIRED.suggestion,
    );
  }

  // Upload the payment proof attachment and get the URL and public ID
  const { secure_url: paidAttachmentURL, public_id: paidAttachementPublicId } =
    await uploadDocToCloudinary(
      file.buffer,
      file.originalname,
      "hrcom/payroll_payment_proofs",
    );

  try {
    const payroll = await Payroll.findOneAndUpdate(
      {
        _id: payrollId,
        status: "validated",
      },
      {
        $set: {
          status: "paid",
          paidBy: user.id,
          paidAt: new Date(),
          paidAttachmentURL,
          paidAttachementPublicId,
        },
      },
      {
        returnDocument: "after",
        session,
      },
    );

    if (!payroll) {
      throw new AppError(
        errors.PAYROLL_NOT_FOUND.message,
        errors.PAYROLL_NOT_FOUND.code,
        errors.PAYROLL_NOT_FOUND.errorCode,
        errors.PAYROLL_NOT_FOUND.suggestion,
      );
    }

    await session.commitTransaction();
    session.endSession();

    // Get the employee details for the audit log
    await payroll.populate({
      path: "employeeId",
      select: "name lastName",
    });

    const employee = payroll.employeeId;

    // Create the audit log for this action
    await logAuditAction({
      adminId: user.id,
      action: "MARK_PAYROLL_AS_PAID",
      targetType: "Payroll",
      targetId: payroll.employeeId,
      targetName: `${employee.name} ${employee.lastName}`,
      details: payroll,
      ipAddress: ip,
    });

    // Send notification to the employee about the paid payroll
    try {
      await createNotification({
        recipientId: employee._id,
        type: "PAYROLL",
        title: "Payroll Marked as Paid",
        message: `Your ${payroll.month}/${payroll.year} payroll has been marked as paid. Check the payroll section for details.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error(
        "Failed to send notification for marked as paid payroll:",
        err,
      );
    }

    // Notify all admins except the one who validated the payroll
    try {
      await createNotificationForAdminsExcept({
        excludedUserId: user.id,
        type: "PAYROLL",
        title: "Payroll Marked as Paid",
        message: `The ${employee.name} ${employee.lastName} ${payroll.month}/${payroll.year}'s payroll has been marked as paid.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error(
        "Failed to send admin notification for marked as paid payroll:",
        err,
      );
    }

    return {
      status: "Success",
      code: 200,
      message: "Payroll marked as paid successfully!",
      data: payroll,
    };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

// Recompute a payroll (Admin only)
export const recomputePayroll = async (payrollId, user, ip) => {
  // Check the payroll existence
  const payroll = await Payroll.findById(payrollId);
  if (!payroll) {
    throw new AppError(
      errors.PAYROLL_NOT_FOUND.message,
      errors.PAYROLL_NOT_FOUND.code,
      errors.PAYROLL_NOT_FOUND.errorCode,
      errors.PAYROLL_NOT_FOUND.suggestion,
    );
  }

  // Check the employee existence
  const employee = await User.findById(payroll.employeeId);
  if (!employee) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  const config = payroll.configSnapshot;

  // Recompute the payroll
  const recomputed = await computePayroll(
    employee,
    payroll.month,
    payroll.year,
    config,
  );

  // Replace only the re-computed fields
  Object.assign(payroll, recomputed);

  // Reset flags after recompute
  payroll.recalculationRequired = false;
  payroll.recalculationReason =
    payroll.recalculationReason || "Manual recompute";
  payroll.recomputedAt = new Date();
  payroll.recomputedBy = user.id;

  await payroll.save();

  // Create the audit log for this action
  await logAuditAction({
    adminId: user.id,
    action: "RECOMPUTE_PAYROLL",
    targetType: "Payroll",
    targetId: payroll._id,
    targetName: `${employee.name} ${employee.lastName}`,
    details: payroll,
    ipAddress: ip,
  });

  // Send notification to the employee about the recomputed payroll
  try {
    await createNotification({
      recipientId: employee._id,
      type: "PAYROLL",
      title: "Payroll Recomputed",
      message: `Your ${payroll.month}/${payroll.year} payroll has been recomputed. Check the payroll section for details.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Failed to send notification for recomputed payroll:", err);
  }

  // Notify all admins except the one who validated the payroll
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "PAYROLL",
      title: "Payroll Recomputed",
      message: `The ${employee.name} ${employee.lastName} ${payroll.month}/${payroll.year}'s payroll has been recomputed.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send admin notification for recomputed payroll:",
      err,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Payroll recomputed successfully!",
    data: payroll,
  };
};

// Export payroll to Excel (Admin only)
export const exportPayrollToExcel = async (payrollId, currentUser, res) => {
  // Retrieve payroll with employee information
  const payroll = await Payroll.findById(payrollId).populate({
    path: "employeeId",
    select: "name lastName email position",
  });

  if (!payroll) {
    throw new AppError(
      errors.PAYROLL_NOT_FOUND.message,
      errors.PAYROLL_NOT_FOUND.code,
      errors.PAYROLL_NOT_FOUND.errorCode,
      errors.PAYROLL_NOT_FOUND.suggestion,
    );
  }

  // Ensure user has access
  canAccessPayroll(currentUser, payroll.employeeId);

  // Generate Excel buffer
  const buffer = await generatePayrollExcel(payroll);

  // Create the personnalised filename
  const employee = payroll.employeeId;
  const safeName = `${employee.name}_${employee.lastName}`.replace(/\s+/g, "_");
  const filename = `Payslip_${safeName}_${payroll.month}_${payroll.year}.xlsx`;

  // Send file
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  res.send(buffer);
};
