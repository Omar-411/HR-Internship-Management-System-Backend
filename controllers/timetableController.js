import User from "../models/User.js";
import Timetable from "../models/Timetable.js";
import AppError from "../utils/AppError.js";
import mongoose from "mongoose";
import { io } from "../server.js";
import { resolveId } from "../utils/idResolver.js";

// -------------------------------------------------------------------- //
// --------------------- TIMETABLE SHIFT RULES ------------------------ //
// -------------------------------------------------------------------- //
const SHIFT_CONFIG = {
  "Morning Shift": {
    startTime: "09:00",
    endTime: "13:00",
  },
  "Evening Shift": {
    startTime: "14:30",
    endTime: "17:00",
  },
  "Full-time Shift": {
    startTime: "09:00",
    endTime: "17:00",
  },
};

// Checks the HH:mm format for startTime and endTime fields in Special Shifts
const isValidTime = (time) => {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
};

// Checks the validity of location
const isValidLocation = (location) => {
  return ["Remote", "Onsite"].includes(location);
};

// -------------------------------------------------------------------- //
// --------------------- TIMETABLE MANAGEMENT ------------------------- //
// -------------------------------------------------------------------- //

// Add a new timetable entry (shift) for a user on a specific date: Only used for empty days (Admin only)
export const addTimetableEntry = async (req, res, next) => {
  try {
    const { userId, date, type, location, color, startTime, endTime } =
      req.body;

    if (!userId || !date || !type) {
      throw new AppError("Missing required fields (userId, date, type)", 400);
    }

    // Check the user existence
    const user = await User.findOne(resolveId(userId));
    if (!user) throw new AppError("User not found!", 404);

    const actualUserId = user._id;

    // Normalize the date to UTC to ensure consistency
    const normalizedDate = new Date(date);
    if (isNaN(normalizedDate.getTime()))
      throw new AppError("Invalid date", 400);
    const dateStr = normalizedDate.toISOString().split("T")[0]; // E.g., "2026-04-04"

    // Check a timetable entry existence for the same user and date
    const existingEntry = await Timetable.findOne({
      userId: actualUserId,
      date: dateStr,
    });
    if (existingEntry) {
      throw new AppError("Timetable already exists for this date!", 400);
    }

    // Prepare the common shift data
    let shiftData = { userId: actualUserId, type, date: dateStr, color };

    // Handle the "Day Off" Adding case
    if (type === "Day Off") {
      const shift = await Timetable.create(shiftData);
      console.log("[ADD-TIMETABLE-ENTRY] Day Off created!");

      io.emit("timetableUpdated", { userId: actualUserId });

      return res.status(201).json({
        status: "Success",
        message: "Day off created successfully!",
        result: shift,
      });
    }

    // Check the location constraint for working shifts (Morning, Evening, Special, Full-time)
    if (!location)
      throw new AppError("Location is required for working shifts!", 400);
    if (!isValidLocation(location)) {
      throw new AppError("Invalid location! Must be 'Remote' or 'Onsite'", 400);
    }
    shiftData.location = location;

    // Handle the working shifts cases (Morning, Evening, Special, Full-time)
    if (type === "Special Shift") {
      if (!startTime || !endTime) {
        throw new AppError(
          "Special Shift requires startTime and endTime!",
          400,
        );
      }
      if (!isValidTime(startTime) || !isValidTime(endTime)) {
        throw new AppError("Time must be HH:mm format!", 400);
      }
      shiftData.startTime = startTime;
      shiftData.endTime = endTime;
    }
    // Handle the Morning, Evening and Full-time shift cases
    else {
      const config = SHIFT_CONFIG[type];
      if (!config) throw new AppError("Invalid shift type!", 400);
      shiftData = { ...shiftData, ...config };
    }

    const shift = await Timetable.create(shiftData);
    console.log(`[ADD-TIMETABLE-ENTRY] ${type} created!`);

    io.emit("timetableUpdated", { userId: actualUserId });

    await markPayrollDirty(actualUserId, new Date(), "Timetable entry created");

    res.status(201).json({
      status: "Success",
      code: 201,
      message: "Timetable entry created successfully!",
      data: shift,
    });
  } catch (err) {
    next(err);
  }
};

// Update timetable entry (shift) for a user on a specific date: For already existing shifts (Admin only)
export const updateTimetableEntry = async (req, res, next) => {
  try {
    const {
      userId,
      date,
      type,
      location,
      color,
      duration,
      specialShiftId,
      specialShiftData,
      specialShiftName,
    } = req.body;

    if (!userId || !date || !type || !location) {
      throw new AppError(
        "Missing required fields (userId, date, type, location)",
        400,
      );
    }

    // Check the user existance
    const user = await User.findOne(resolveId(userId));
    if (!user) {
      throw new AppError("User not found", 404);
    }
    const actualUserId = user._id;

    // Normalize date to midnight to ensure consistent indexing
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const shift = await Timetable.findOneAndUpdate(
      { userId: actualUserId, date: normalizedDate },
      {
        type,
        location,
        color,
        duration,
        specialShiftId,
        specialShiftData,
        specialShiftName,
      },
      { new: true, upsert: true, runValidators: true },
    );

    io.emit("timetableUpdated", { userId: actualUserId });

    await markPayrollDirty(actualUserId, new Date(), "Timetable entry updated");

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Timetable entry updated successfully!",
      data: shift,
    });
  } catch (err) {
    next(err);
  }
};

// Get timetable (shifts) for a specific user
export const getTimetableByUser = async (req, res, next) => {
  try {
    const { userId } = req.params; // Get userId from URL parameters
    const { month, year } = req.query; // Month and year filtering (Pagination)

    // Check the user existance
    const user = await User.findOne(resolveId(userId));
    if (!user) {
      throw new AppError("User not found", 404);
    }
    const actualUserId = user._id;

    // Check if the id (if supervisor) is the user's supervisor id
    // BUT allow users to see their own timetable regardless of role
    if (
      req.user.id !== actualUserId.toString() &&
      req.user.role === "Supervisor" &&
      user.supervisor_id &&
      !user.supervisor_id.equals(new mongoose.Types.ObjectId(req.user.id))
    ) {
      throw new AppError("Unauthorized!", 403);
    }

    // Pagination of shifts  by month and year (Default: current month timetable)
    const now = new Date();
    const queryMonth = month ? Number(month) : now.getUTCMonth() + 1;
    const queryYear = year ? Number(year) : now.getUTCFullYear();

    // Calculate the first and last day of the month
    const startDate = new Date(Date.UTC(queryYear, queryMonth - 1, 1));
    const endDate = new Date(
      Date.UTC(queryYear, queryMonth, 0, 23, 59, 59, 999),
    );

    // Find all shifts for the user within the specified month
    const shifts = await Timetable.find({
      userId: actualUserId,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    // [DEBUG-PAGINATION] Added log to track pagination requests from frontend for testing purposes
    console.log(
      `[PAGINATION] Module: Timetable | Month: ${queryMonth || ""} | Year: ${queryYear || ""} | Returned: ${shifts?.length || 0} records`,
    );

    // Special pagination for the month by month timetable retrieval
    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Timetable fetched successfully!",
      data: shifts,
      pagination: {
        month: queryMonth,
        year: queryYear,
        totalCount: shifts.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get all timetables (shifts) for all users (Admin/Supervisor only)
export const getAllTimetables = async (req, res, next) => {
  try {
    const { month, year } = req.query;

    const now = new Date();
    const queryMonth = month ? Number(month) : now.getUTCMonth() + 1;
    const queryYear = year ? Number(year) : now.getUTCFullYear();

    const startDate = new Date(Date.UTC(queryYear, queryMonth - 1, 1));
    const endDate = new Date(Date.UTC(queryYear, queryMonth, 0, 23, 59, 59, 999));

    const filter = {
      date: { $gte: startDate, $lte: endDate },
    };

    // If Supervisor, only get timetables for users they supervise
    if (req.user.role === "Supervisor") {
      const supervisees = await User.find({ supervisor_id: req.user.id }).select("_id");
      const superviseeIds = supervisees.map((u) => u._id);
      filter.userId = { $in: superviseeIds };
    }

    const shifts = await Timetable.find(filter).sort({ date: 1 });

    res.status(200).json({
      status: "Success",
      message: "All timetables fetched successfully!",
      result: shifts,
      meta: {
        month: queryMonth,
        year: queryYear,
        total: shifts.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Bulk update or create multiple timetable entries (shifts) for a user across multiple dates: STILL NOT DONE
export const bulkUpdateTimetableEntries = async (req, res, next) => {
  try {
    const { userId, dates, type, location, color, startTime, endTime } =
      req.body;

    if (
      !userId ||
      !dates ||
      !Array.isArray(dates) ||
      dates.length === 0 ||
      !type ||
      !location
    ) {
      throw new AppError(
        "Missing required fields (userId, dates array, type, location)",
        400,
      );
    }

    // Check the user existence
    const user = await User.findOne(resolveId(userId));
    if (!user) {
      throw new AppError("User not found", 404);
    }
    const actualUserId = user._id;

    const updatedShifts = [];

    for (const date of dates) {
      // Normalize the date to UTC to ensure consistency
      const normalizedDate = new Date(date);
      if (isNaN(normalizedDate.getTime()))
        throw new AppError("Invalid date", 400);
      const dateStr = normalizedDate.toISOString().split("T")[0]; // E.g., "2026-04-04"

      // Prepare the common shift data
      let shiftData = {
        userId,
        date: dateStr,
        type,
        color,
      };

      // Handle the "Day Off" case
      if (type === "Day Off") {
        const shift = await Timetable.findOneAndUpdate(
          { userId: actualUserId, date: dateStr },
          shiftData,
          { returnDocument: "after", upsert: true, runValidators: true },
        );

        updatedShifts.push(shift);
        continue; // Move to the next date
      } else {
        // For working shifts (Morning, Evening, Full-time and Special Shift)

        // Check the location constraint for working shifts (Morning, Evening, Special, Full-time)
        if (!location) {
          throw new AppError("Location is required for working shifts!", 400);
        }
        if (!isValidLocation(location)) {
          throw new AppError(
            "Invalid location! Must be 'Remote' or 'Onsite'",
            400,
          );
        }

        // Morning, Evening, Full-time and Special Shift cases
        if (type !== "Special Shift") {
          const config = SHIFT_CONFIG[type];
          if (!config) throw new AppError("Invalid shift type", 400);
          shiftData = { ...shiftData, ...config };
          shiftData.location = location;
        } else {
          // Special Shift requires startTime and endTime
          if (!startTime || !endTime) {
            throw new AppError(
              "Special Shift requires both startTime and endTime!",
              400,
            );
          }
          if (!isValidTime(startTime) || !isValidTime(endTime)) {
            throw new AppError(
              "startTime and endTime must be in HH:mm format!",
              400,
            );
          }

          shiftData = { ...shiftData, startTime, endTime };
          shiftData.location = location;
        }

        const shift = await Timetable.findOneAndUpdate(
          { userId: actualUserId, date: dateStr, type },
          shiftData,
          { returnDocument: "after", upsert: true, runValidators: true },
        );

        updatedShifts.push(shift);
      }
    }

    // Notify user of schedule change
    io.emit("timetableUpdated", { userId: actualUserId });

    await markPayrollDirty(actualUserId, new Date(), "Bulk timetable update");

    res.status(200).json({
      status: "Success",
      code: 200,
      message: `${updatedShifts.length} timetable entries updated successfully!`,
      data: updatedShifts,
    });
  } catch (err) {
    next(err);
  }
};

// Delete a timetable entry (a user shift) for a specific date
export const deleteTimetableEntry = async (req, res, next) => {
  try {
    const { userId, date, type } = req.body;

    if (!userId || !date || !type) {
      throw new AppError("Missing required fields (userId, date, type)", 400);
    }

    // Check the user existance
    const user = await User.findOne(resolveId(userId));
    if (!user) {
      throw new AppError("User not found", 404);
    }
    const actualUserId = user._id;

    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    // Check the timetable entry existance
    const existingEntry = await Timetable.findOne({
      userId: actualUserId,
      date: normalizedDate,
      type,
    });
    if (!existingEntry) {
      throw new AppError(
        "Timetable entry not found for the specified date and type",
        404,
      );
    }

    await Timetable.findOneAndDelete({ userId: actualUserId, date: normalizedDate, type });

    // Notify user of schedule change
    io.emit("timetableUpdated", { userId: actualUserId });

    await markPayrollDirty(actualUserId, new Date(), "Timetable entry deleted");

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Timetable entry deleted successfully!",
    });
  } catch (err) {
    next(err);
  }
};

// Clear all shift records for a specific month (Admin/HR Only)
export const clearMonthTimetable = async (req, res, next) => {
  try {
    const { userId, year: yearParam, month: monthParam } = req.params;

    if (!userId || yearParam === undefined || monthParam === undefined) {
      throw new AppError(
        "Missing required parameters (userId, year, month)",
        400,
      );
    }

    const year = parseInt(yearParam);
    const month = parseInt(monthParam);

    if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
      throw new AppError("Invalid year or month format", 400);
    }

    // Check the user existence
    const user = await User.findOne(resolveId(userId));
    if (!user) {
      throw new AppError("User not found", 404);
    }
    const actualUserId = user._id;

    // Compute first and last day of the month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // Delete all timetable entries for the user within the specified month
    const result = await Timetable.deleteMany({
      userId: actualUserId,
      date: { $gte: startDate, $lte: endDate },
    });

    // Notify user of schedule change
    io.emit("timetableUpdated", { userId: actualUserId });

    await markPayrollDirty(actualUserId, new Date(), "Monthly timetable cleared");

    res.status(200).json({
      status: "Success",
      code: 200,
      message: `${startDate.toLocaleString("default", { month: "long" })} timetable cleared successfully!`,
      data: {
        deletedCount: result.deletedCount,
      },
    });
  } catch (err) {
    next(err);
  }
};
