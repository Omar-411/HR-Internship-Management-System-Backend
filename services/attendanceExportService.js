import AttendanceStats from "../models/AttendanceStats.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import { aggregateStats, generateStats } from "./attendanceStatsService.js";
import { exportStatsCSV, exportStatsExcel } from "../utils/exportStats.js";
import { sanitize } from "../utils/exportHelpers.js";

// ---------- Helper functions to generate a nice filename ---------- //
const getPeriodTypeName = (periodType) => {
  switch (periodType) {
    case "day":
      return "daily";
    case "month":
      return "monthly";
    case "trimester":
      return "trimester";
    case "year":
      return "yearly";
    case "custom":
      return "custom";
    default:
      return periodType;
  }
};

export const getStatsPeriodLabel = ({
  periodType,
  month,
  trimester,
  year,
  startDate,
  endDate,
}) => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  if (periodType === "day") return `${startDate}`;
  if (periodType === "month") return `${months[month - 1]}_${year}`;
  if (periodType === "trimester") return `T${trimester}_${year}`;
  if (periodType === "year") return `${year}`;

  if (periodType === "custom") {
    const format = (d) => new Date(d).toISOString().split("T")[0]; // Format as YYYY-MM-DD
    return `${format(startDate)}_to_${format(endDate)}`; // e.g., "2024-01-01_to_2024-03-31"
  }

  return "period";
};

import { resolveId } from "../utils/idResolver.js";

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
    userIds = users.map((u) => u._id);
  } else if (userId) {
    const userMatch = resolveId(userId);
    const user = await User.findOne(userMatch);
    if (!user) throw new Error("User not found!");
    actualUserId = user._id;
    userIds = [actualUserId];
  } else {
    const users = await User.find();
    userIds = users.map((u) => u._id);
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
    const fullName = `${user.name}_${user.lastName || ""}`;
    cleanName = sanitize(fullName);
  }

  // Get the department name if it's a department export (for filename)
  if (departmentId) {
    const departmentName = await Department.findById(departmentId);
    deptName = sanitize(departmentName.name);
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
    fileName = `${getPeriodTypeName(periodType)}_attendance_stats_for_${cleanName}__${periodLabel}.${extension}`.toLowerCase();
  }
  else if (departmentId) {
    fileName = `${getPeriodTypeName(periodType)}_attendance_stats_for_${deptName}_department__${periodLabel}.${extension}`.toLowerCase();
  }
  else {
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
