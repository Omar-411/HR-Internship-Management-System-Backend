import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import AttendanceStats from "../models/AttendanceStats.js";
import { getDayRange, getMonthRange, getTrimesterRange, getYearRange } from "../utils/periodHelpers.js";

// Helper function to parse time strings like "09:17 AM" into minutes from midnight
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return NaN;
  // Match HH:MM AM/PM
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return NaN;
  
  let [_, hoursStr, minutesStr, ampm] = match;
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  
  if (ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
  if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
};

// Stat generation function (Grneralized for any period type)
export const generateStats = async ({ startDate, endDate, periodType }) => {
  // Fetch all users to calculate stats for each user
  const users = await User.find();

  // Calculate KPI per user per period for aggregation later
  for (const user of users) {
    // Get the user's attendance records for the specified period
    const records = await Attendance.find({
      userId: user._id,
      date: { $gte: startDate, $lte: endDate },
    });

    // Calculate KPIs (Present, Late, Absent, Avg Check-in)
    const present = records.filter(r => r.status === "present").length;
    const late = records.filter(r => r.status === "late").length;
    const absent = records.filter(r => r.status === "absent").length;
    
    const checkInTimes = records
      .filter(r => r.checkInTime)
      .map(r => parseTimeToMinutes(r.checkInTime))
      .filter(m => !isNaN(m));

    const avgCheckInMinutes = checkInTimes.length
      ? Math.round(checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length)
      : null;

    // Update the stats for this user and period
    await AttendanceStats.findOneAndUpdate(
      {
        userId: user._id,
        periodType,
        startDate,
        endDate,
      },
      {
        userId: user._id,
        periodType,
        startDate,
        endDate,
        present,
        late,
        absent,
        avgCheckInMinutes,
        totalAttendance: records.length, // Sum of present + late + absent
      },
      { upsert: true, returnDocument: 'after' }
    );
  }
};

// Daily stats generation function
export const generateDailyStats = async () => {
  const { start, end } = getDayRange();

  await generateStats({
    startDate: start,
    endDate: end,
    periodType: "day",
  });

  console.log("Daily stats generated!");
};

// Monthly stats generation function
export const generateMonthlyStats = async (year, month) => {
  const { start, end } = getMonthRange(year, month);

  await generateStats({
    startDate: start,
    endDate: end,
    periodType: "month",
  });

  console.log("Monthly stats generated!");
};

// Trimester stats generation function
export const generateTrimesterStats = async (year, trimester) => {
  const { start, end } = getTrimesterRange(year, trimester);

  await generateStats({
    startDate: start,
    endDate: end,
    periodType: "trimester",
  });

  console.log("Trimester stats generated!");
};

// Yearly stats generation function
export const generateYearlyStats = async (year) => {
  const { start, end } = getYearRange(year);

  await generateStats({
    startDate: start,
    endDate: end,
    periodType: "year",
  });

  console.log("Yearly stats generated!");
};

// Custom range stats generation function
export const generateCustomStats = async (startDate, endDate) => {
  await generateStats({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    periodType: "custom",
  });

  console.log("Custom stats generated!");
};

// Aggregation function to combine stats across multiple users/departments
export const aggregateStats = (stats) => {
  const totalPresent = stats.reduce((sum, s) => sum + s.present, 0);
  const totalLate = stats.reduce((sum, s) => sum + s.late, 0);
  const totalAbsent = stats.reduce((sum, s) => sum + s.absent, 0);

  const avgCheckIn =
    stats.length > 0
      ? Math.round(
          stats.reduce((sum, s) => sum + (s.avgCheckInMinutes || 0), 0) /
          stats.length
        )
      : null;

  return {
    present: totalPresent,
    late: totalLate,
    absent: totalAbsent,
    avgCheckInMinutes: avgCheckIn,
  };
};
