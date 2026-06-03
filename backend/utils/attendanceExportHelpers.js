import AttendanceStats from "../models/AttendanceStats.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import AppError from "./AppError.js";
import {
  aggregateStats,
  generateStats,
} from "../utils/generateStatsHelpers.js";
import { exportStatsCSV, exportStatsExcel } from "./exportStats.js";
import { slugify } from "./slugify.js";
import { resolveId } from "./idResolver.js";
import { getPeriodTypeName, getStatsPeriodLabel } from "./periodHelpers.js";

// Main export function for attendance stats
export const exportAttendanceStats = async ({
  userId,
  departmentId,
  periodType,
  startDate,
  endDate,
  selectedKPIs = ["present", "late", "absent", "avgCheckInMinutes"], // Array of KPI names
  format = "csv",
  res,
}) => {
  let userIds = [];
  let actualUserId = userId;

  // Get all relevant users
  if (departmentId) {
    const users = await User.find({ department_id: departmentId });
    if (users.length !== 0) {
      userIds = users.map((u) => u._id);
    }
  } else if (userId) {
    const userMatch = resolveId(userId);
    
    const user = await User.findOne(userMatch);
    if (!user)
      throw new AppError(
        commonErrors.USER_NOT_FOUND.message,
        commonErrors.USER_NOT_FOUND.code,
        commonErrors.USER_NOT_FOUND.errorCode,
        commonErrors.USER_NOT_FOUND.suggestion,
      );

    actualUserId = user._id;
    userIds = [actualUserId];
  } else {
    // All users
    const users = await User.find();

    if (users.length !== 0) {
      userIds = users.map((u) => u._id);
    }
  }

  // Fetch stats for selected users and period
  let stats = await AttendanceStats.find({
    userId: { $in: userIds },
    periodType,
    startDate: { $gte: new Date(startDate) },
    endDate: { $lte: new Date(endDate) },
  }).populate("userId", "name lastName email department_id");

  // If no stats found, try to generate them on the fly
  if (!stats.length) {
    try {
      await generateStats({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        periodType,
      });

      // Try fetching again after generation
      stats = await AttendanceStats.find({
        userId: { $in: userIds },
        periodType,
        startDate: { $gte: new Date(startDate) },
        endDate: { $lte: new Date(endDate) },
      }).populate("userId", "name lastName email department_id");
    } catch (genErr) {
      console.error("Error generating stats on the fly:", genErr);
    }
  }

  if (!stats.length) {
    throw new Error("No attendance stats found for the export!");
  }

  // Aggregate stats if multiple users
  let dataToExport = stats;
  if (userIds.length > 1) {
    const aggregated = aggregateStats(stats);

    dataToExport = [
      {
        ...aggregated,
        userId: null,
        periodType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    ];
  }

  // ------ Build the filename ------ //
  let cleanName = "";
  let deptName = "";

  // Get the username if it's a single user export (for filename)
  if (actualUserId) {
    const user = await User.findById(actualUserId);
    const clearName = `${user.slug}`;
  }

  // Get the department name if it's a department export (for filename)
  if (departmentId) {
    const departmentName = await Department.findById(departmentId);
    deptName = slugify(departmentName.name);
  }

  // Get the right file extension
  const extension = format === "csv" ? "csv" : "xlsx";

  // GetPeriod Label for the filename
  const periodLabel = getStatsPeriodLabel({
    periodType,
    month: new Date(startDate).getMonth() + 1,
    trimester: Math.ceil((new Date(startDate).getMonth() + 1) / 4),
    year: new Date(startDate).getFullYear(),
    startDate,
    endDate,
  });

  // Generate the Filename
  let fileName;
  if (userId) {
    fileName =
      `${getPeriodTypeName(periodType)}_attendance_stats_for_${cleanName}__${periodLabel}.${extension}`.toLowerCase();
  } else if (departmentId) {
    fileName =
      `${getPeriodTypeName(periodType)}_attendance_stats_for_${deptName}_department__${periodLabel}.${extension}`.toLowerCase();
  } else {
    fileName =
      `${getPeriodTypeName(periodType)}_attendance_stats__${periodLabel}.${extension}`.toLowerCase();
  }

  // Export based on format
  if (format === "csv")
    return exportStatsCSV(dataToExport, selectedKPIs, res, fileName);
  if (format === "excel")
    return exportStatsExcel(dataToExport, selectedKPIs, res, fileName);

  throw new Error("Invalid export format!");
};
