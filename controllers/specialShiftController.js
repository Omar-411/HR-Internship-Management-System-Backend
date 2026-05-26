import SpecialShift from "../models/SpecialShift.js";
import { errors } from "../errors/specialShiftErrors.js";
import AppError from "../utils/AppError.js";

// Get all reusable Special Shift types
export const getSpecialShifts = async (req, res, next) => {
  try {
    const shifts = await SpecialShift.find()
      .sort({ createdAt: -1 })
      .populate("createdBy", "name lastName");

    res.status(200).json({
      status: "Success",
      code: 200,
      message: `${shifts.length} Special Shift types retrieved successfully!`,
      data: shifts,
    });
  } catch (err) {
    next(err);
  }
};

// Create a new reusable Special Shift type
export const createSpecialShift = async (req, res, next) => {
  try {
    const { name, description, type, periods } = req.body;

    // Input Validation
    if (!name || !name.trim()) {
      throw new AppError(
        errors.SHIFT_NAME_REQUIRED.message,
        errors.SHIFT_NAME_REQUIRED.code,
        errors.SHIFT_NAME_REQUIRED.errorCode,
        errors.SHIFT_NAME_REQUIRED.suggestion
      );
    }

    if (!type || !["single", "double"].includes(type)) {
      throw new AppError(
        errors.SHIFT_TYPE_INVALID.message,
        errors.SHIFT_TYPE_INVALID.code,
        errors.SHIFT_TYPE_INVALID.errorCode,
        errors.SHIFT_TYPE_INVALID.suggestion
      );
    }

    if (!Array.isArray(periods) || periods.length === 0) {
      throw new AppError(
        errors.SHIFT_PERIODS_REQUIRED.message,
        errors.SHIFT_PERIODS_REQUIRED.code,
        errors.SHIFT_PERIODS_REQUIRED.errorCode,
        errors.SHIFT_PERIODS_REQUIRED.suggestion
      );
    }

    // Enforce type ↔ period count consistency
    if (type === "single" && periods.length !== 1) {
      throw new AppError(
        "Single shift type must have only 1 period",
        errors.SHIFT_PERIODS_TYPE_MISMATCH.code,
        errors.SHIFT_PERIODS_TYPE_MISMATCH.errorCode,
        errors.SHIFT_PERIODS_TYPE_MISMATCH.suggestion
      );
    }
    if (type === "double" && periods.length !== 2) {
      throw new AppError(
        "Double shift type must have 2 periods",
        errors.SHIFT_PERIODS_TYPE_MISMATCH.code,
        errors.SHIFT_PERIODS_TYPE_MISMATCH.errorCode,
        errors.SHIFT_PERIODS_TYPE_MISMATCH.suggestion
      );
    }

    // Validate each period's time format (HH:MM)
    const timeRegex = /^\d{2}:\d{2}$/;

    for (let i = 0; i < periods.length; i++) {
      const { startTime, endTime } = periods[i] || {};

      if (!startTime || !timeRegex.test(startTime)) {
        throw new AppError(
          `Period ${i + 1}: startTime must be in HH:MM format`,
          errors.SPECIAL_SHIFT_TIME_FORMAT_INVALID.code,
          errors.SPECIAL_SHIFT_TIME_FORMAT_INVALID.errorCode,
          errors.SPECIAL_SHIFT_TIME_FORMAT_INVALID.suggestion
        );
      }
      
      if (!endTime || !timeRegex.test(endTime)) {
        throw new AppError(
          `Period ${i + 1}: endTime must be in HH:MM format`,
          errors.SPECIAL_SHIFT_TIME_FORMAT_INVALID.code,
          errors.SPECIAL_SHIFT_TIME_FORMAT_INVALID.errorCode,
          errors.SPECIAL_SHIFT_TIME_FORMAT_INVALID.suggestion
        );
      }
    }

    const specialShift = await SpecialShift.create({
      name: name.trim(),
      description: description?.trim() || "",
      type,
      periods,
      createdBy: req.user.id,
    });

    res.status(201).json({
      status: "Success",
      code: 201,
      message: "Special Shift type created successfully",
      data: specialShift,
    });
  } catch (err) {
    next(err);
  }
};
