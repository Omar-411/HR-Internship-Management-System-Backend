import User from "../models/User.js";
import Timetable from "../models/Timetable.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors } from "../errors/timetableErrors.js";
import AppError from "../utils/AppError.js";
import mongoose from "mongoose";
import { io } from "../server.js";
import { resolveId } from "../utils/idResolver.js";
import { createNotification } from "../services/notificationService.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";
import { markPayrollDirty } from "../utils/payrollHelpers.js";
import {
  isValidTime,
  isValidLocation,
} from "../validators/timetableValidators.js";
import { SHIFT_CONFIG } from "../constants/timetableConstants.js";

// Upsert timetable entry (shift) for a user on a specific date: For already existing shifts (Admin only)
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

    if (!userId || !date || !type) {
      throw new AppError(
        errors.MISSING_REQUIRED_FIELDS.message,
        errors.MISSING_REQUIRED_FIELDS.code,
        errors.MISSING_REQUIRED_FIELDS.errorCode,
        errors.MISSING_REQUIRED_FIELDS.suggestion,
      );
    }

    if (type !== "Day Off" && !location) {
      throw new AppError(
        errors.LOCATION_REQUIRED.message,
        errors.LOCATION_REQUIRED.code,
        errors.LOCATION_REQUIRED.errorCode,
        errors.LOCATION_REQUIRED.suggestion,
      );
    }

    if (location && !isValidLocation(location)) {
      throw new AppError(
        errors.INVALID_LOCATION.message,
        errors.INVALID_LOCATION.code,
        errors.INVALID_LOCATION.errorCode,
        errors.INVALID_LOCATION.suggestion,
      );
    }

    // Check the user existance
    const user = await User.findOne(resolveId(userId)).populate(
      "role_id",
      "name",
    );
    if (!user) {
      throw new AppError(
        commonErrors.USER_NOT_FOUND.message,
        commonErrors.USER_NOT_FOUND.code,
        commonErrors.USER_NOT_FOUND.errorCode,
        commonErrors.USER_NOT_FOUND.suggestion,
      );
    }

    const actualUserId = user._id;

    // Normalize date to midnight to ensure consistent indexing
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    // Prepare shift times
    let startTime = undefined;
    let endTime = undefined;

    // Auto-assign times for normal shifts
    if (SHIFT_CONFIG[type]) {
      startTime = SHIFT_CONFIG[type].startTime;
      endTime = SHIFT_CONFIG[type].endTime;
    }

    // Day Off, then no start and end times
    if (type === "Day Off") {
      startTime = undefined;
      endTime = undefined;
    }

    const shift = await Timetable.findOneAndUpdate(
      {
        userId: actualUserId,
        date: normalizedDate,
      },
      {
        type,
        location: type === "Day Off" ? undefined : location,
        color,
        duration,
        specialShiftId,
        specialShiftData,
        specialShiftName,
        startTime: type === "Day Off" ? undefined : startTime,
        endTime: type === "Day Off" ? undefined : endTime,
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
      },
    );

    io.emit("timetableUpdated", { userId: actualUserId });

    // Send notification to the user about the timetable shift updating
    try {
      await createNotification({
        recipientId: user._id,
        type: "TIMETABLE",
        title: "A shift has been set in your timetable",
        message: `A shift in your timetable at ${shift.date.toDateString()} has been set.`,
        data: {
          entityType: "TIMETABLE",
          entityId: shift._id,
        },
      });
    } catch (error) {
      console.log("Shift updating notification failed:", error.message);
    }

    // Notify all admins except the one who updated the timetable shift entry
    try {
      await createNotificationForAdminsExcept({
        excludedUserId: req.user.id,
        type: "TIMETABLE",
        title: `A shift has been set in ${user.name} ${user.lastName}'s timetable`,
        message: `A shift for ${user.name} ${user.lastName} on ${shift.date.toDateString()} has been set.`,
        data: {
          entityType: "TIMETABLE",
          entityId: shift._id,
        },
      });
    } catch (err) {
      console.error(
        "Failed to send notification for shift updating to admins:",
        err,
      );
    }

    if (user.role_id.name === "Employee") {
      await markPayrollDirty(actualUserId, new Date(), "Timetable entry set");
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Timetable entry set successfully!",
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
      throw new AppError(
        commonErrors.USER_NOT_FOUND.message,
        commonErrors.USER_NOT_FOUND.code,
        commonErrors.USER_NOT_FOUND.errorCode,
        commonErrors.USER_NOT_FOUND.suggestion,
      );
    }

    const actualUserId = user._id;

    // Authorization check: 
    // Employees can only access their own timetable, Supervisors can access timetables of their supervisees, Admins can access all timetables
    if (
      req.user.id !== actualUserId.toString() &&
      req.user.role === "Supervisor" &&
      user.supervisor_id &&
      !user.supervisor_id.equals(new mongoose.Types.ObjectId(req.user.id))
    ) {
      throw new AppError(
        errors.UNAUTHORIZED_TO_ACCESS_TIMETABLE.message,
        errors.UNAUTHORIZED_TO_ACCESS_TIMETABLE.code,
        errors.UNAUTHORIZED_TO_ACCESS_TIMETABLE.errorCode,
        errors.UNAUTHORIZED_TO_ACCESS_TIMETABLE.suggestion,
      );
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

    console.log(
      `[PAGINATION] Module: Timetable | Month: ${queryMonth || ""} | Year: ${queryYear || ""} | Returned: ${shifts?.length || 0} records`,
    );

    // Custom pagination (not the basic currentPage one) for the month by month timetable retrieval
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
    const endDate = new Date(
      Date.UTC(queryYear, queryMonth, 0, 23, 59, 59, 999),
    );

    const filter = {
      date: { $gte: startDate, $lte: endDate },
    };

    // If Supervisor, only get timetables for users they supervise
    if (req.user.role === "Supervisor") {
      const supervisees = await User.find({
        supervisor_id: req.user.id,
      }).select("_id");
      const superviseeIds = supervisees.map((u) => u._id);
      filter.userId = { $in: superviseeIds };
    }

    const shifts = await Timetable.find(filter).sort({ date: 1 });

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "All timetables fetched successfully!",
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
        errors.MISSING_REQUIRED_FIELDS.message,
        errors.MISSING_REQUIRED_FIELDS.code,
        errors.MISSING_REQUIRED_FIELDS.errorCode,
        errors.MISSING_REQUIRED_FIELDS.suggestion,
      );
    }

    // Check the user existence
    const user = await User.findOne(resolveId(userId)).populate(
      "role_id",
      "name",
    );
    if (!user) {
      throw new AppError(
        commonErrors.USER_NOT_FOUND.message,
        commonErrors.USER_NOT_FOUND.code,
        commonErrors.USER_NOT_FOUND.errorCode,
        commonErrors.USER_NOT_FOUND.suggestion,
      );
    }

    const actualUserId = user._id;

    const updatedShifts = [];

    for (const date of dates) {
      // Normalize the date to UTC to ensure consistency
      const normalizedDate = new Date(date);
      if (isNaN(normalizedDate.getTime()))
        throw new AppError(
          errors.INVALID_DATE.message,
          errors.INVALID_DATE.code,
          errors.INVALID_DATE.errorCode,
          errors.INVALID_DATE.suggestion,
        );

      const dateStr = normalizedDate.toISOString().split("T")[0]; // E.g., "2026-04-04"

      // Prepare the common shift data
      let shiftData = {
        userId: actualUserId,
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
          throw new AppError(
            errors.LOCATION_REQUIRED.message,
            errors.LOCATION_REQUIRED.code,
            errors.LOCATION_REQUIRED.errorCode,
            errors.LOCATION_REQUIRED.suggestion,
          );
        }
        if (!isValidLocation(location)) {
          throw new AppError(
            errors.INVALID_LOCATION.message,
            errors.INVALID_LOCATION.code,
            errors.INVALID_LOCATION.errorCode,
            errors.INVALID_LOCATION.suggestion,
          );
        }

        // Morning, Evening, Full-time and Special Shift cases
        if (type !== "Special Shift") {
          const config = SHIFT_CONFIG[type];

          if (!config)
            throw new AppError(
              errors.INVALID_SHIFT_TYPE.message,
              errors.INVALID_SHIFT_TYPE.code,
              errors.INVALID_SHIFT_TYPE.errorCode,
              errors.INVALID_SHIFT_TYPE.suggestion,
            );

          shiftData = { ...shiftData, ...config };
          shiftData.location = location;
        } else {
          // Special Shift requires startTime and endTime
          if (!startTime || !endTime) {
            throw new AppError(
              errors.SPECIAL_SHIFT_DATES_REQUIRED.message,
              errors.SPECIAL_SHIFT_DATES_REQUIRED.code,
              errors.SPECIAL_SHIFT_DATES_REQUIRED.errorCode,
              errors.SPECIAL_SHIFT_DATES_REQUIRED.suggestion,
            );
          }

          if (!isValidTime(startTime) || !isValidTime(endTime)) {
            throw new AppError(
              errors.INVALID_SPECIAL_SHIFT_DATES.message,
              errors.INVALID_SPECIAL_SHIFT_DATES.code,
              errors.INVALID_SPECIAL_SHIFT_DATES.errorCode,
              errors.INVALID_SPECIAL_SHIFT_DATES.suggestion,
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

    if (user.role_id.name === "Employee") {
      await markPayrollDirty(actualUserId, new Date(), "Bulk timetable update");
    }

    // Send notification to the user about the timetable shifts updating
    try {
      await createNotification({
        recipientId: user._id,
        type: "TIMETABLE",
        title: `${updatedShifts.length} shifts have been updated in your timetable`,
        message: `${updatedShifts.length} shifts in your timetable at ${dates.join(", ")} have been updated.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (error) {
      console.log("Shifts updating notification failed:", error.message);
    }

    // Notify all admins except the one who added/updates the timetable shifts
    try {
      await createNotificationForAdminsExcept({
        excludedUserId: req.user.id,
        type: "TIMETABLE",
        title: `${updatedShifts.length} shifts have been updated in ${user.name} ${user.lastName}'s timetable`,
        message: `${updatedShifts.length} shifts for ${user.name} ${user.lastName} on ${dates.join(", ")} have been updated.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error(
        "Failed to send notification for shift updating to admins:",
        err,
      );
    }

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
    const { userId, date } = req.body;

    if (!userId || !date) {
      throw new AppError(
        errors.MISSING_REQUIRED_FIELDS.message,
        errors.MISSING_REQUIRED_FIELDS.code,
        errors.MISSING_REQUIRED_FIELDS.errorCode,
        errors.MISSING_REQUIRED_FIELDS.suggestion,
      );
    }

    // Check the user existance
    const user = await User.findOne(resolveId(userId)).populate(
      "role_id",
      "name",
    );
    if (!user) {
      throw new AppError(
        commonErrors.USER_NOT_FOUND.message,
        commonErrors.USER_NOT_FOUND.code,
        commonErrors.USER_NOT_FOUND.errorCode,
        commonErrors.USER_NOT_FOUND.suggestion,
      );
    }

    const actualUserId = user._id;

    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    // Check the timetable entry existance
    const existingEntry = await Timetable.findOne({
      userId: actualUserId,
      date: normalizedDate,
    });

    if (!existingEntry) {
      throw new AppError(
        errors.TIMETABLE_NOT_FOUND.message,
        errors.TIMETABLE_NOT_FOUND.code,
        errors.TIMETABLE_NOT_FOUND.errorCode,
        errors.TIMETABLE_NOT_FOUND.suggestion,
      );
    }

    const deletedEntry = await Timetable.findOneAndDelete({
      userId: actualUserId,
      date: normalizedDate,
    });

    // Notify user of schedule change
    io.emit("timetableUpdated", { userId: actualUserId });

    if (user.role_id.name === "Employee") {
      await markPayrollDirty(
        actualUserId,
        new Date(),
        "Timetable entry deleted",
      );
    }

    // Send notification to the user about the timetable shift deleting
    try {
      await createNotification({
        recipientId: user._id,
        type: "TIMETABLE",
        title: `Shift has been deleted in your timetable`,
        message: `A shift has been deleted from your timetable at ${deletedEntry.date.toDateString()}.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (error) {
      console.log("Shifts deleting notification failed:", error.message);
    }

    // Notify all admins except the one who deleted the timetable shift entry
    try {
      await createNotificationForAdminsExcept({
        excludedUserId: req.user.id,
        type: "TIMETABLE",
        title: `A shift has been deleted from ${user.name} ${user.lastName}'s timetable`,
        message: `A shift for ${user.name} ${user.lastName} on ${deletedEntry.date.toDateString()} has been deleted.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error(
        "Failed to send notification for shift deleting to admins:",
        err,
      );
    }

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
        errors.MISSING_REQUIRED_FIELDS.message,
        errors.MISSING_REQUIRED_FIELDS.code,
        errors.MISSING_REQUIRED_FIELDS.errorCode,
        errors.MISSING_REQUIRED_FIELDS.suggestion,
      );
    }

    const year = parseInt(yearParam);
    const month = parseInt(monthParam);

    if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
      throw new AppError(
        errors.INVALID_DATE.message,
        errors.INVALID_DATE.code,
        errors.INVALID_DATE.errorCode,
        errors.INVALID_DATE.suggestion,
      );
    }

    // Check the user existence
    const user = await User.findOne(resolveId(userId)).populate(
      "role_id",
      "name",
    );
    if (!user) {
      throw new AppError(
        commonErrors.USER_NOT_FOUND.message,
        commonErrors.USER_NOT_FOUND.code,
        commonErrors.USER_NOT_FOUND.errorCode,
        commonErrors.USER_NOT_FOUND.suggestion,
      );
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

    if (user.role_id.name === "Employee") {
      await markPayrollDirty(
        actualUserId,
        new Date(),
        "Monthly timetable cleared",
      );
    }

    // Send notification to the user about the timetable month clearing
    try {
      await createNotification({
        recipientId: user._id,
        type: "TIMETABLE",
        title: `Monthly timetable has been cleared`,
        message: `Your timetable for ${startDate.toLocaleString("default", { month: "long" })} has been cleared.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (error) {
      console.log(
        "Monthly timetable clearing notification failed:",
        error.message,
      );
    }

    // Notify all admins except the one who cleared the monthly timetable
    try {
      await createNotificationForAdminsExcept({
        excludedUserId: req.user.id,
        type: "TIMETABLE",
        title: `Monthly timetable cleared for ${user.name} ${user.lastName}`,
        message: `The timetable for ${user.name} ${user.lastName} for ${startDate.toLocaleString("default", { month: "long" })} has been cleared.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.error(
        "Failed to send notification for monthly timetable clearing to admins:",
        err,
      );
    }

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
