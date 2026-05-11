import mongoose from "mongoose";
import User from "../models/User.js";
import Payroll from "../models/Payroll.js";
import PayrollConfig from "../models/PayrollConfig.js";
import { errors } from "../errors/payrollErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors as payrollConfigErrors } from "../errors/payrollConfigErrors.js";
import AppError from "../utils/AppError.js";
import { validateUserStatus } from "../validators/authValidators.js";
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

// Payroll calculation for an employee for a given month and year
export const calculatePayroll = async (employeeId, month, year) => {
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

  // Get the active config
  const configDoc = await PayrollConfig.findOne({ year, isActive: true });
  if (!configDoc) {
    throw new AppError(
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.message,
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.code,
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.errorCode,
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.suggestion,
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
export const markPayrollAsPaid = async (payrollId, user, ip) => {
  const session = await mongoose.startSession();
  session.startTransaction();

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
  const payroll = await Payroll.findById(payrollId);
  if (!payroll) {
    throw new AppError(
      errors.PAYROLL_NOT_FOUND.message,
      errors.PAYROLL_NOT_FOUND.code,
      errors.PAYROLL_NOT_FOUND.errorCode,
      errors.PAYROLL_NOT_FOUND.suggestion,
    );
  }

  // Only draft payrolls can be recomputed
  if (payroll.status !== "draft") {
    throw new AppError(
      errors.PAYROLL_NOT_DRAFT.message,
      errors.PAYROLL_NOT_DRAFT.code,
      errors.PAYROLL_NOT_DRAFT.errorCode,
      errors.PAYROLL_NOT_DRAFT.suggestion,
    );
  }

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

  // Merge result safely
  payroll.set(recomputed);

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

  return {
    status: "Success",
    code: 200,
    message: "Payroll exported to Excel successfully!",
  };
};
