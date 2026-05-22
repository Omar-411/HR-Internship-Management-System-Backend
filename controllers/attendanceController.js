import User from "../models/User.js";
import Department from "../models/Department.js";
import Attendance from "../models/Attendance.js";
import Timetable from "../models/Timetable.js";
import UserRole from "../models/UserRole.js";
import Alert from "../models/Alert.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors as departmentErrors } from "../errors/departmentErrors.js";
import { errors as attendanceErrors } from "../errors/attendanceErrors.js";
import { errors as timetableErrors } from "../errors/timetableErrors.js";
import AppError from "../utils/AppError.js";
import { buildDateFilter } from "../utils/timeHelpers.js";
import {
  exportCSV,
  exportExcel,
} from "../utils/exportHelpers.js";
import {
  getPeriodLabel,
} from "../utils/periodHelpers.js";
import { slugify } from "../utils/slugify.js";
import { exportAttendanceStats } from "../utils/attendanceExportHelpers.js";
import { markPayrollDirty } from "../utils/payrollHelpers.js";
import { createNotification } from "../services/notificationService.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";
import {
  COMPANY_LOCATION,
  TOLERANCE_METERS,
  getDistanceInMeters,
} from "../utils/geo.js";
import {
  nonceKey,
  purgeExpiredFaceChallenges,
  signablePayloadString,
  safeEqualHex,
  verifyFaceProof,
  indicatesCheckIn,
} from "../utils/attendanceHelpers.js";
import {
  getUtcDayRange,
  getStartOfDay,
  getEndOfDay,
} from "../utils/timeHelpers.js";
import {
  FACE_NONCE_TTL_MS,
  FACE_CLOCK_SKEW_MS,
  FACE_ATTESTATION_SECRET,
  faceNonceStore,
} from "../constants/attendanceConstants.js";

// Get the list of statuses (Admin/Supervisor)
export const getAllStatuses = async (req, res, next) => {
  try {
    const statuses = Attendance.schema.path("status").enumValues;

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Attendance statuses retrieved successfully!",
      data: statuses,
    });
  } catch (error) {
    next(error);
  }
};

// Get the user's attendance status for today
export const getMyStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { start: today, end: tomorrow } = getUtcDayRange(new Date());

    // Check the user's existence
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json(
          commonErrors.USER_NOT_FOUND.message,
          commonErrors.USER_NOT_FOUND.code,
          commonErrors.USER_NOT_FOUND.errorCode,
          commonErrors.USER_NOT_FOUND.suggestion,
        );
    }

    // Get today's attendance record for the user
    let attendance = await Attendance.findOne({
      userId,
      date: { $gte: today, $lt: tomorrow },
    }).sort({ date: -1 });

    // Legacy/bad-data recovery: find a record updated today that indicates check-in
    const legacyCheckIn = await Attendance.findOne({
      userId,
      updatedAt: { $gte: today, $lt: tomorrow },
      $or: [
        { checkInTime: { $exists: true, $ne: null } },
        { status: { $in: ["present", "late"] } },
      ],
    }).sort({ updatedAt: -1 });

    if (!attendance && legacyCheckIn) {
      attendance = legacyCheckIn;
      const d = attendance.date ? new Date(attendance.date) : null;
      const needsRepair = !d || d < today || d >= tomorrow;
      if (needsRepair) {
        attendance.date = today;
        await attendance.save();
      }
    } else if (attendance && legacyCheckIn && !indicatesCheckIn(attendance)) {
      // Merge legacy check-in details into the canonical "today" record
      attendance.checkInTime =
        legacyCheckIn.checkInTime || attendance.checkInTime;
      attendance.checkOutTime =
        legacyCheckIn.checkOutTime ?? attendance.checkOutTime;
      attendance.location = legacyCheckIn.location || attendance.location;
      attendance.workLocation =
        legacyCheckIn.workLocation || attendance.workLocation;
      if (
        legacyCheckIn.status === "present" ||
        legacyCheckIn.status === "late"
      ) {
        attendance.status = legacyCheckIn.status;
      }
      await attendance.save();
    }

    if (!attendance) {
      return res.status(200).json({
        status: "success",
        code: 200,
        message:
          "No attendance record found for today. You haven't checked in yet!",
        data: null,
      });
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Attendance record retrieved successfully!",
      data: attendance,
    });
  } catch (err) {
    next(err);
  }
};

// Get attendance records (Admin/Supervisor)
export const getAttendance = async (req, res, next) => {
  try {
    const {
      userId,
      startDate,
      endDate,
      status,
      role,
      department,
      search,
      page = 1,
      limit: queryLimit,
    } = req.query;

    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const limit = parseInt(queryLimit) || 20;
    const skip = (parsedPage - 1) * limit;

    const filter = {}; // Allow filtering

    let targetUserId = userId;

    // Check for user existence if userId is provided
    if (userId) {
      const userMatch = resolveId(userId);
      const user = await User.findOne(userMatch);
      if (!user) {
        return res.status(404).json({
          status: "Error",
          code: 404,
          message: "User not found!",
        });
      }
      targetUserId = user._id;
    }

    // Authorization & checking the Identity
    if (req.user.role === "Admin" || req.user.role === "Supervisor") {
      if (targetUserId) filter.userId = targetUserId;
    } else {
      filter.userId = req.user.id;
    }

    // Date Filtering
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = getStartOfDay(startDate);
      if (endDate) filter.date.$lte = getEndOfDay(endDate);
    }

    // Status filtering
    if (status) {
      filter.status = status;
    }

    // SEARCH & FILTER CONFIGURATION (on Users)
    const userFilter = {};
    if (search) {
      userFilter.$or = [
        { name: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (role) {
      const roleDoc = await UserRole.findOne({
        name: { $regex: `^${role}$`, $options: "i" },
      });
      if (roleDoc) userFilter.role_id = roleDoc._id;
    }

    if (department) {
      const deptDoc = await Department.findOne({
        name: { $regex: `^${department}$`, $options: "i" },
      });
      if (deptDoc) userFilter.department_id = deptDoc._id;
    }

    if (req.query.forSummary === "true") {
      const totalUsers = await User.countDocuments(userFilter);

      const pagedUsers = await User.find(userFilter)
        .populate("role_id", "name")
        .populate("department_id", "name")
        .populate("supervisor_id", "name lastName")
        .skip(skip)
        .limit(limit)
        .lean();

      // Find attendance records for these specific users on the target date
      const attendanceFilter = {
        date: {
          $gte: getStartOfDay(startDate),
          $lte: getEndOfDay(endDate),
        },
      };
      const userIds = pagedUsers.map((u) => u._id);
      attendanceFilter.userId = { $in: userIds };

      const records = await Attendance.find(attendanceFilter)
        .populate({
          path: "userId",
          populate: [
            { path: "role_id", select: "name" },
            { path: "department_id", select: "name" },
            { path: "supervisor_id", select: "name lastName" },
          ],
        })
        .lean();

      // Map attendance onto the users (Left Join)
      const mappedResults = pagedUsers.map((user) => {
        const record = records.find(
          (r) => r.userId.toString() === user._id.toString(),
        );
        return (
          record || {
            userId: {
              _id: user._id,
              name: user.name,
              lastName: user.lastName,
              email: user.email,
              role_id: user.role_id,
              department_id: user.department_id,
              supervisor_id: user.supervisor_id,
            },
            date: getStartOfDay(startDate),
            status: "absent",
            checkInTime: null,
            checkOutTime: null,
            workLocation: null,
            isImplicit: true,
          }
        );
      });

      // Special handling: if we return the user object inside 'userId', it matches 'populate' format
      const finalResults = mappedResults.map((res) => {
        if (res.isImplicit) {
          // Flatten user if already populated
          return res;
        }
        // For real records, we need to populate userId manually if not already (though we didn't populate it in find(filter) above)
        // Actually, for consistency, let's keep the user object in 'userId'
        return res;
      });

      // Mandatory Logging
      // [DEBUG-ATTENDANCE] Total users: X | Users with attendance: Y | Date: selectedDate
      console.log(
        `[DEBUG-ATTENDANCE] Total users: ${totalUsers} | Users with attendance: ${records.length} | Page: ${parsedPage} | Date: ${startDate}`,
      );

      return res.status(200).json({
        status: "Success",
        code: 200,
        data: finalResults,
        pagination: {
          currentPage: parsedPage,
          totalPages: Math.ceil(totalUsers / limit),
          limitPerPage: limit,
          totalCount: finalResults.length,
        },
      });
    }

    // ─── Standard 'Record-Centric' Logic (For History / Calendar) ───────────────────

    // Search for users matching the userFilter criteria and get their IDs
    let userIds = null;
    if (Object.keys(userFilter).length > 0) {
      const users = await User.find(userFilter).select("_id");
      userIds = users.map((u) => u._id);

      // If no users match, then we return an empty result
      if (userIds.length === 0) {
        return res.status(200).json({
          status: "Success",
          code: 200,
          data: [],
          pagination: {
            currentPage: parsedPage,
            totalPages: 0,
            limitPerPage: limit,
            totalCount: 0,
          },
        });
      }

      if (filter.userId && !Array.isArray(filter.userId)) {
        // A specific userId was already set — check if it's in the matched set
        const specificId = filter.userId.toString();
        const inSet = userIds.some((id) => id.toString() === specificId);
        if (!inSet) {
          return res.status(200).json({
            status: "Success",
            code: 200,
            data: [],
            pagination: {
              currentPage: parsedPage,
              totalPages: 0,
              limitPerPage: limit,
              totalCount: 0,
            },
          });
        }
        // else: keep filter.userId as the specific ID (more precise than $in)
      } else {
        filter.userId = { $in: userIds };
      }
    }

    // Get total count for pagination
    const totalRecords = await Attendance.countDocuments(filter);

    // Get attendance records
    const attendanceRecords = await Attendance.find(filter)
      .populate({
        path: "userId",
        populate: [
          { path: "role_id", select: "name" },
          { path: "department_id", select: "name" },
        ],
      })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // [PAGINATION-DEBUG] Added log to track backend output
    console.log(
      `[PAGINATION] Module: Attendance | Page: ${parsedPage || 1} | Limit: ${limit || 10} | Returned: ${attendanceRecords?.length || 0} records`,
    );

    return res.status(200).json({
      status: "Success",
      code: 200,
      data: attendanceRecords,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(totalRecords / limit),
        limitPerPage: limit,
        totalCount: attendanceRecords.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await Attendance.findById(id).populate({
      path: "userId",
      populate: [
        { path: "role_id", select: "name" },
        { path: "department_id", select: "name" },
      ],
    });

    if (!record) {
      return res
        .status(404)
        .json({ status: "Error", message: "Attendance record not found!" });
    }

    const requesterId = String(req.user.id);
    const recordOwnerId = String(record.userId._id || record.userId);
    const role = req.user.role;

    if (
      role !== "Admin" &&
      role !== "Supervisor" &&
      requesterId !== recordOwnerId
    ) {
      return res
        .status(403)
        .json({ status: "Error", message: "Unauthorized!" });
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Attendance record retrieved successfully!",
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

// Create a face challenge for the user to sign (for check-in verification on the client side before check-in)
export const createFaceChallenge = async (req, res, next) => {
  try {
    const userId = req.user.id;
    purgeExpiredFaceChallenges();

    const nonce = crypto.randomBytes(24).toString("hex");
    const now = Date.now();
    const key = nonceKey(userId, nonce);
    faceNonceStore.set(key, {
      userId: String(userId),
      nonce,
      createdAt: now,
      expiresAt: now + FACE_NONCE_TTL_MS,
      used: false,
      usedAt: null,
    });

    return res.status(200).json({
      status: "Success",
      code: 200,
      message: "Face challenge created successfully!",
      data: {
        nonce,
        expiresInMs: FACE_NONCE_TTL_MS,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Check-in function
export const checkIn = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { location, latitude, longitude, faceProof } = req.body || {};

    // Optional face attestation: validate only when faceProof is provided.
    if (faceProof) {
      const faceValidation = verifyFaceProof(userId, faceProof);
      if (!faceValidation.ok) {
        return res.status(401).json({
          status: "Error",
          code: 401,
          message: faceValidation.message,
        });
      }
    }

    const now = new Date();
    const { start: todayUTC, end: tomorrowUTC } = getUtcDayRange(now);

    // Get the user's existence
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(
        commonErrors.USER_NOT_FOUND.message,
        commonErrors.USER_NOT_FOUND.code,
        commonErrors.USER_NOT_FOUND.errorCode,
        commonErrors.USER_NOT_FOUND.suggestion,
      );
    }

    // Require Face ID enrollment before check-in
    if (!user.faceEnrolled) {
      throw new AppError(
        attendanceErrors.FACE_NOT_ENROLLED.message,
        attendanceErrors.FACE_NOT_ENROLLED.code,
        attendanceErrors.FACE_NOT_ENROLLED.errorCode,
        attendanceErrors.FACE_NOT_ENROLLED.suggestion,
      );
    }

    // Try to get today's shift
    const shift = await Timetable.findOne({
      userId,
      date: { $gte: todayUTC, $lt: tomorrowUTC },
    });

    if (!shift) {
      throw new AppError(
        timetableErrors.TIMETABLE_NOT_FOUND.message,
        timetableErrors.TIMETABLE_NOT_FOUND.code,
        timetableErrors.TIMETABLE_NOT_FOUND.errorCode,
        timetableErrors.TIMETABLE_NOT_FOUND.suggestion,
      );
    }

    // Determine the work location
    let workLocation = "Remote";
    if (location === "Remote" || location === "Onsite") {
      workLocation = location;
    } else if (shift.location === "Remote" || shift.location === "Onsite") {
      workLocation = shift.location;
    }

    // Determine the presence status (late/present)
    let status = "present";
    const resolvedStartTime =
      shift.startTime || shift.specialShiftData?.periods?.[0]?.startTime;

    if (resolvedStartTime) {
      const [startHour, startMinute] = resolvedStartTime.split(":").map(Number);
      const shiftStart = new Date(todayUTC);
      shiftStart.setUTCHours(startHour, startMinute, 0, 0);
      const grace = shift.gracePeriod || 5;
      const lateThreshold = new Date(shiftStart.getTime() + grace * 60000);
      if (now > lateThreshold) status = "late";
    }

    const checkInTime = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const updateSet = {
      date: todayUTC,
      checkInTime,
      status,
      workLocation,
      checkOutTime: null,
    };
    if (typeof latitude === "number" && typeof longitude === "number") {
      updateSet.location = { latitude, longitude };
    }

    const attendance = await Attendance.findOneAndUpdate(
      { userId, date: { $gte: todayUTC, $lt: tomorrowUTC } },
      {
        $set: updateSet,
        $setOnInsert: {
          userId,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
        sort: { date: -1, updatedAt: -1 },
      },
    );

    await markPayrollDirty(userId, now, "Check-in recorded");

    // Location mismatch alert (system-generated and only for onsite check-ins not remote)
    if (workLocation === "Onsite") {
      try {
        let shouldAlert = false;
        let alertSubject = "Onsite Check-In Location Anomaly";
        let alertDescription = "";

        if (typeof latitude === "number" && typeof longitude === "number") {
          const distanceMeters = getDistanceInMeters(
            latitude,
            longitude,
            COMPANY_LOCATION.lat,
            COMPANY_LOCATION.lng,
          );

          if (distanceMeters > TOLERANCE_METERS) {
            shouldAlert = true;

            const displayedDistance = Number.isFinite(distanceMeters)
              ? `${Math.round(distanceMeters).toLocaleString()} meters`
              : "a far unknown distance";

            alertDescription =
              `Employee ${user.name} ${user.lastName} checked in as "onsite", ` +
              `but their recorded location was ${displayedDistance} from the registered office location.\n\n` +
              `Employee coordinates: (${latitude.toFixed(5)}, ${longitude.toFixed(5)})\n` +
              `Office coordinates: (${COMPANY_LOCATION.lat.toFixed(6)}, ${COMPANY_LOCATION.lng.toFixed(6)})\n` +
              `Allowed tolerance: ${TOLERANCE_METERS.toLocaleString()} meters\n\n` +
              `Attendance has been recorded successfully.`;
          }
        } else {
          shouldAlert = true;
          alertSubject = "Onsite Check-In Location Permission Denied";
          alertDescription =
            `Employee ${user.name} ${user.lastName} attempted an "onsite" check-in but the location ` +
            `access was denied by the browser or device. ` +
            "\n" +
            `Unable to verify physical presence at the office. ` +
            "\n" +
            `Attendance has been recorded.`;
        }

        if (shouldAlert) {
          await Alert.create({
            senderId: null,
            isSystemGenerated: true,
            alertType: "TECHNICAL",
            recipientType: "HR_DEPARTMENT",
            recipientId: null,
            subject: alertSubject,
            description: alertDescription,
            status: "NEW",
            isAnonymous: false,
            attachmentURL: "",
            attachmentPublicId: "",
            alertDate: now,
          });
        }
      } catch (alertErr) {
        console.error(
          "[ATTENDANCE] Failed to create location alert:",
          alertErr instanceof Error ? alertErr.message : alertErr,
        );
      }
    }

    // Emit (Sends a message) real-time event to all connected clients
    req.app?.get("io")?.emit("attendanceUpdated", {
      action: "checkIn",
      userId: String(userId),
      attendance,
    });

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Checked in successfully!",
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

// Attendance record update (Admin only)
export const updateAttendance = async (req, res, next) => {
  try {
    const { id } = req.params; // Attendance record ID
    const updates = req.body;

    const attendance = await Attendance.findByIdAndUpdate(id, updates, {
      returnDocument: "after",
    });

    if (!attendance) {
      return res
        .status(404)
        .json(
          attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.message,
          attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.code,
          attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.errorCode,
          attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.suggestion,
        );
    }

    // Get the user for notification and payroll purposes
    const user = await User.findById(attendance.userId).select(
      "name lastName supervisor_id",
    );
    if (!user) {
      return res
        .status(404)
        .json(
          commonErrors.USER_NOT_FOUND.message,
          commonErrors.USER_NOT_FOUND.code,
          commonErrors.USER_NOT_FOUND.errorCode,
          commonErrors.USER_NOT_FOUND.suggestion,
        );
    }

    // Mark related payroll as dirty for recalculation
    await markPayrollDirty(
      attendance.userId,
      attendance.date,
      "Attendance updated",
    );

    // Emit real-time event for admin updates too
    req.app?.get("io")?.emit("attendanceUpdated", {
      action: "adminUpdate",
      attendance,
    });

    // Send notification to the user about the attendance update
    try {
      await createNotification({
        recipientId: user._id,
        type: "ATTENDANCE",
        title: "Attendance Record Updated",
        message: `Your attendance record for ${attendance.date.toDateString()} has been updated.`,
        data: {
          entityType: "ATTENDANCE",
          entityId: attendance._id,
        },
      });
    } catch (error) {
      console.log("Attendance update notification failed:", error.message);
    }

    // Notify all admins except the one who updated the attendance record
    try {
      await createNotificationForAdminsExcept({
        excludedUserId: req.user.id,
        type: "ATTENDANCE",
        title: "Attendance Record Updated",
        message: `An attendance record of ${user.name} ${user.lastName} for ${attendance.date.toDateString()} has been updated.`,
        data: {
          entityType: "ATTENDANCE",
          entityId: attendance._id,
        },
      });
    } catch (err) {
      console.error("Failed to send notification for attendance update:", err);
    }

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Attendance record updated successfully!",
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

// Check-out
export const checkOut = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const now = new Date();
    const { start: todayUTC, end: tomorrowUTC } = getUtcDayRange(now);

    // Check the user's existance
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json(
          commonErrors.USER_NOT_FOUND.message,
          commonErrors.USER_NOT_FOUND.code,
          commonErrors.USER_NOT_FOUND.errorCode,
          commonErrors.USER_NOT_FOUND.suggestion,
        );
    }

    const checkOutTime = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Find today's attendance record and update the check-out time
    const attendance = await Attendance.findOneAndUpdate(
      { userId, date: { $gte: todayUTC, $lt: tomorrowUTC } },
      { $set: { checkOutTime } },
      {
        returnDocument: "after",
        runValidators: true,
        sort: { date: -1, updatedAt: -1 },
      },
    );

    if (!attendance) {
      return res
        .status(404)
        .json(
          attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.message,
          attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.code,
          attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.errorCode,
          attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.suggestion,
        );
    }

    await markPayrollDirty(userId, now, "Check-out recorded");

    // Emit real-time event to all connected clients
    req.app?.get("io")?.emit("attendanceUpdated", {
      action: "checkOut",
      userId: String(userId),
      attendance,
    });

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Checked out successfully!",
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

// Export the attendance records of a precise user to CSV/Excel (Admin Only)
export const exportUserAttendance = async (req, res, next) => {
  try {
    const {
      userName,
      userLastName,
      userEmail,
      type,
      year,
      month,
      trimester,
      format,
      startDate,
      endDate,
    } = req.query;

    // Validate user existance
    const user = await User.findOne({
      name: userName,
      lastName: userLastName,
      email: userEmail,
    });
    if (!user) {
      throw new AppError(
        commonErrors.USER_NOT_FOUND.message,
        commonErrors.USER_NOT_FOUND.code,
        commonErrors.USER_NOT_FOUND.errorCode,
        commonErrors.USER_NOT_FOUND.suggestion,
      );
    }

    // Validate custom
    if (type === "custom" && (!startDate || !endDate)) {
      throw new AppError(
        attendanceErrors.START_END_DATE_REQUIRED.message,
        attendanceErrors.START_END_DATE_REQUIRED.code,
        attendanceErrors.START_END_DATE_REQUIRED.errorCode,
        attendanceErrors.START_END_DATE_REQUIRED.suggestion,
      );
    }

    if (type === "custom" && new Date(startDate) > new Date(endDate)) {
      throw new AppError(
        attendanceErrors.START_DATE_AFTER_END_DATE.message,
        attendanceErrors.START_DATE_AFTER_END_DATE.code,
        attendanceErrors.START_DATE_AFTER_END_DATE.errorCode,
        attendanceErrors.START_DATE_AFTER_END_DATE.suggestion,
      );
    }

    // Build date filter
    const dateFilter = buildDateFilter({
      type,
      year,
      month,
      trimester,
      startDate,
      endDate,
    });

    // Fetch the attendance records
    const records = await Attendance.find({
      userId: user._id,
      date: dateFilter,
    }).sort({ date: 1 });

    if (records.length === 0) {
      throw new AppError(
        "Attendance records not found",
        attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.code,
        attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.errorCode,
        attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.suggestion,
      );
    }

    // Format data
    const formatted = records.map((r) => ({
      Date: r.date.toISOString().split("T")[0],
      CheckIn: r.checkInTime || "-",
      CheckOut: r.checkOutTime || "-",
      Status: r.status || "absent",
    }));

    // Build the filename (The user name included)
    const cleanName = `${user.slug}`;
    const periodLabel = getPeriodLabel({
      type,
      year,
      month,
      trimester,
      startDate,
      endDate,
    });

    const extension = format === "csv" ? "csv" : "xlsx";
    const fileName =
      `attendance_${cleanName}_${periodLabel}.${extension}`.toLowerCase();

    // Export based on the requested format (CSV or Excel)
    if (format === "csv") {
      return exportCSV(formatted, res, fileName);
    }

    if (format === "excel") {
      return exportExcel(formatted, res, fileName);
    }

    // If the format requested is Invalid
    throw new AppError(
      attendanceErrors.INVALID_EXPORT_FORMAT.message,
      attendanceErrors.INVALID_EXPORT_FORMAT.code,
      attendanceErrors.INVALID_EXPORT_FORMAT.errorCode,
      attendanceErrors.INVALID_EXPORT_FORMAT.suggestion,
    );
  } catch (err) {
    next(err);
  }
};

// Export the attendance records of the department users to CSV/Excel (Admin Only)
export const exportDepartmentAttendance = async (req, res, next) => {
  try {
    const {
      departmentName,
      type,
      year,
      month,
      trimester,
      startDate,
      endDate,
      format,
    } = req.query;

    // Activate the includeName flag to include the user names in the export file
    const includeName = true;

    // Get department and check its existance by name (Because the department names are unique)
    const department = await Department.findOne({ name: departmentName });
    if (!department) {
      throw new AppError(
        departmentErrors.DEPARTMENT_NOT_FOUND.message,
        departmentErrors.DEPARTMENT_NOT_FOUND.code,
        departmentErrors.DEPARTMENT_NOT_FOUND.errorCode,
        departmentErrors.DEPARTMENT_NOT_FOUND.suggestion,
      );
    }

    // Get all the users in that department
    const users = await User.find({ department_id: department._id });
    if (!users.length) {
      throw new AppError(
        commonErrors.USER_NOT_FOUND.message,
        commonErrors.USER_NOT_FOUND.code,
        commonErrors.USER_NOT_FOUND.errorCode,
        commonErrors.USER_NOT_FOUND.suggestion,
      );
    }

    // Extract user IDs for attendance query
    const userIds = users.map((u) => u._id);

    // Build the date filter
    const dateFilter = buildDateFilter({
      type,
      year: Number(year),
      month: Number(month),
      trimester: Number(trimester),
      startDate,
      endDate,
    });

    // Get attendance records
    const records = await Attendance.find({
      userId: { $in: userIds },
      date: dateFilter,
    }).populate("userId", "name lastName");

    if (!records.length) {
      throw new AppError(
        attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.message,
        attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.code,
        attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.errorCode,
        attendanceErrors.ATTENDANCE_RECORD_NOT_FOUND.suggestion,
      );
    }

    // Format the return data for export
    const formattedData = records.map((r) => ({
      Name: `${r.userId.name} ${r.userId.lastName}`,
      Date: r.date.toISOString().split("T")[0], // Format date as YYYY-MM-DD
      CheckIn: r.checkInTime || "-",
      CheckOut: r.checkOutTime || "-",
      Status: r.status,
      Location: r.location || "-",
    }));

    // Sanitize the department name for the filename
    const cleanDeptName = slugify(department.name);

    // Build the filename (The user name included)
    const periodLabel = getPeriodLabel({
      type,
      year,
      month,
      trimester,
      startDate,
      endDate,
    });

    const extension = format === "csv" ? "csv" : "xlsx";

    // Generate file name
    const fileName =
      `attendance_${cleanDeptName}_department_${periodLabel}.${extension}`.toLowerCase();

    // Export logic
    if (format === "csv") {
      return exportCSV(formattedData, res, fileName);
    }

    if (format === "excel") {
      return exportExcel(formattedData, res, fileName, includeName);
    }

    throw new AppError(
      attendanceErrors.INVALID_EXPORT_FORMAT.message,
      attendanceErrors.INVALID_EXPORT_FORMAT.code,
      attendanceErrors.INVALID_EXPORT_FORMAT.errorCode,
      attendanceErrors.INVALID_EXPORT_FORMAT.suggestion,
    );
  } catch (error) {
    next(error);
  }
};

// Export attendance stats (KPIs) for users to CSV/Excel (Admin Only)
export const exportAttendanceStatistics = async (req, res, next) => {
  try {
    const {
      userName,
      userLastName,
      userEmail,
      departmentName,
      periodType,
      startDate,
      endDate,
      kpis,
      format,
    } = req.query;

    let userId = null;
    let departmentId = null;

    // Validate user existance and get the user ID (If the stats export is for a specific user)
    if (userName & userLastName && userEmail) {
      const user = await User.findOne({
        name: userName,
        lastName: userLastName,
        email: userEmail,
      });
      if (!user) {
        throw new AppError(
          commonErrors.USER_NOT_FOUND.message,
          commonErrors.USER_NOT_FOUND.code,
          commonErrors.USER_NOT_FOUND.errorCode,
          commonErrors.USER_NOT_FOUND.suggestion,
        );
      }

      userId = user._id;
    }

    // Validate department existance
    if (departmentName) {
      const department = await Department.findOne({ name: departmentName });
      if (!department) {
        throw new AppError(
          departmentErrors.DEPARTMENT_NOT_FOUND.message,
          departmentErrors.DEPARTMENT_NOT_FOUND.code,
          departmentErrors.DEPARTMENT_NOT_FOUND.errorCode,
          departmentErrors.DEPARTMENT_NOT_FOUND.suggestion,
        );
      }
      departmentId = department._id;
    }

    // Get the selected KPIs from the query
    const selectedKPIs = kpis ? kpis.split(",") : undefined;

    await exportAttendanceStats({
      userId,
      departmentId,
      periodType,
      startDate,
      endDate,
      selectedKPIs,
      format,
      res,
    });
  } catch (error) {
    next(error);
  }
};
