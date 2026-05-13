import mongoose from "mongoose";
import User from "../models/User.js";
import Payroll from "../models/Payroll.js";
import PayrollConfig from "../models/PayrollConfig.js";
import UserRole from "../models/UserRole.js";
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
} from "../utils/payrollHelpers.js";
import { getOne, getAll } from "./handlersFactory.js";
import { logAuditAction } from "../utils/logger.js";

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
      }
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

// Get monthly net payout trend for the last 6 months
export const getPayrollTrend = async () => {
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();

  // Build the last 6 months (inclusive of current)
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const trend = await Promise.all(
    months.map(async ({ year, month }) => {
      const result = await Payroll.aggregate([
        { $match: { year, month } },
        { $group: { _id: null, netPayout: { $sum: "$netSalary" } } },
      ]);
      return {
        month: MONTH_NAMES[month - 1],
        netPayout: result[0]?.netPayout ?? 0,
      };
    })
  );

  return { status: "Success", code: 200, data: trend };
};

// Get net payout aggregated by department for a given month/year
export const getPayrollByDepartment = async (queryParams) => {
  const now = new Date();
  const month = parseInt(queryParams?.month) || now.getMonth() + 1;
  const year  = parseInt(queryParams?.year)  || now.getFullYear();

  const result = await Payroll.aggregate([
    { $match: { month, year } },
    {
      $lookup: {
        from: "users",
        localField: "employeeId",
        foreignField: "_id",
        as: "employee",
      },
    },
    { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "departments",
        localField: "employee.department_id",
        foreignField: "_id",
        as: "department",
      },
    },
    { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ["$department.name", "Unknown"] },
        netPayout: { $sum: "$netSalary" },
      },
    },
    {
      $project: {
        _id: 0,
        department: "$_id",
        netPayout: 1,
      },
    },
    { $sort: { netPayout: -1 } },
  ]);

  return { status: "Success", code: 200, data: result };
};

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
      select: "name lastName",
    });

    const employee = payroll.employeeId;

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
    await session.abortTransaction();
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
  payroll.recalculationReason = payroll.recalculationReason || "Manual recompute";
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

// Bulk calculation for all eligible employees for a given month and year
export const calculateBulkPayroll = async (month, year, user, ip) => {
  // 1. Get the active config for the year
  const configDoc = await PayrollConfig.findOne({ year, isActive: true });
  if (!configDoc) {
    throw new AppError(
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.message,
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.code,
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.errorCode,
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.suggestion,
    );
  }

  // 2. Find all active employees who are NOT interns
  // We identify interns by role name "Intern"
  const roles = await UserRole.find({ name: { $nin: ["Intern", "intern"] } });
  const roleIds = roles.map(r => r._id);

  const users = await User.find({
    status: "Active",
    role_id: { $in: roleIds }
  });

  const results = {
    created: 0,
    skipped: 0,
    errors: 0
  };

  for (const employee of users) {
    try {
      // Check if payroll already exists
      const existing = await Payroll.findOne({ employeeId: employee._id, month, year });
      if (existing) {
        results.skipped++;
        continue;
      }

      // Compute the payroll
      const computed = await computePayroll(employee, month, year, configDoc);

      // Create payroll
      await Payroll.create({
        employeeId: employee._id,
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
          }
        },
        status: "draft",
      });
      results.created++;
    } catch (err) {
      console.error(`Error calculating payroll for ${employee.name}:`, err);
      results.errors++;
    }
  }

  // Audit log
  await logAuditAction({
    adminId: user.id,
    action: "BULK_CALCULATE_PAYROLL",
    targetType: "Payroll",
    details: { month, year, results },
    ipAddress: ip,
  });

  return {
    status: "Success",
    code: 200,
    message: `Bulk payroll calculation completed: ${results.created} created, ${results.skipped} skipped, ${results.errors} errors.`,
    data: results,
  };
};
