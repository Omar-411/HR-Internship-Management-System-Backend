import cron from "node-cron";
import Attendance from "../models/Attendance.js";
import Timetable from "../models/Timetable.js";
import { markPayrollDirty } from "../utils/payrollHelpers.js";

// Day-off cron job (Runs daily at 00:00)
cron.schedule("0 0 * * *", async () => {
  console.log("[DAY-OFF-CRON-JOB] Running day-off attendance generation...");

  try {
    // Create today's UTC boundaries
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // Get all timetables marked as "Day Off" for today
    const dayOffTimetables = await Timetable.find({
      date: { $gte: today, $lt: tomorrow },
      type: "Day Off",
    });

    for (const timetable of dayOffTimetables) {
      await Attendance.findOneAndUpdate(
        {
          userId: timetable.userId,
          date: { $gte: today, $lt: tomorrow },
        },
        {
          $setOnInsert: {
            userId: timetable.userId,
            date: today,
            status: "day-off",
          },
        },
        {
          upsert: true,
          returnDocument: "after",
        },
      );
      await markPayrollDirty(
        timetable.userId,
        today,
        "Day-off attendance generated",
      );
    }

    console.log(
      `[DAY-OFF-CRON-JOB] Day-off attendance created: ${dayOffTimetables.length}`,
    );
    console.log(
      `[DAY-OFF-CRON-JOB] Day-off attendance records created: ${dayOffTimetables.length}.`,
    );
  } catch (err) {
    console.error("[DAY-OFF-CRON-JOB] Day-off attendance error:", err);
  }
});

// Absence cron job (Runs every 15 minutes)
cron.schedule("*/15 * * * *", async () => {
  console.log("[ABSENCE-CRON-JOB] Running absence detection...");

  try {
    const now = new Date();

    // Today's UTC boundaries
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    let absenceCount = 0;

    // Get all today's working timetables
    const timetables = await Timetable.find({
      date: { $gte: today, $lt: tomorrow },
      type: { $ne: "Day Off" },
    }).populate("specialShiftId");

    for (const timetable of timetables) {
      // Skip public holidays
      if (timetable.isPublicHoliday) {
        continue;
      }

      // Check if attendance already exists
      const existingAttendance = await Attendance.findOne({
        userId: timetable.userId,
        date: { $gte: today, $lt: tomorrow },
      });

      // If already checked in / leave / late / day-off
      if (existingAttendance) {
        continue;
      }

      let endTime = null;

      // NORMAL SHIFTS
      if (
        ["Morning Shift", "Evening Shift", "Full-time Shift"].includes(
          timetable.type,
        )
      ) {
        endTime = timetable.endTime;
      }

      // SPECIAL SHIFT
      else if (timetable.type === "Special Shift") {
        // CASE 1: Inline custom shift data
        if (
          timetable.specialShiftData?.periods?.length
        ) {
          const periods = timetable.specialShiftData.periods;

          // Get the latest end time (In case of multiple periods)
          endTime = periods[periods.length - 1].endTime;
        }

        // CASE 2: Linked special shift
        else if (
          timetable.specialShiftId?.periods?.length
        ) {
          const periods = timetable.specialShiftId.periods;

          // Get the latest end time (In case of multiple periods)
          endTime = periods[periods.length - 1].endTime;
        }
      }

      // Skip invalid shifts
      if (
        !endTime ||
        typeof endTime !== "string" ||
        !endTime.includes(":")
      ) {
        console.warn(
          `[ABSENCE-CRON-JOB] Invalid endTime for timetable ${timetable._id}`,
        );
        continue;
      }

      // Parse HH:mm
      const [hours, minutes] = endTime.split(":");

      // Create shift end datetime
      const shiftEnd = new Date(timetable.date);

      shiftEnd.setUTCHours(
        Number(hours),
        Number(minutes),
        0,
        0,
      );

      // Add grace period
      shiftEnd.setUTCMinutes(
        shiftEnd.getUTCMinutes() + (timetable.gracePeriod || 0),
      );

      // MARK THE USER AS ABSENT
      if (now > shiftEnd) {
        await Attendance.create({
          userId: timetable.userId,
          date: today,
          status: "absent",
        });
        await markPayrollDirty(
          timetable.userId,
          today,
          "Absence attendance generated",
        );

        console.log(
          `[ABSENCE-CRON-JOB] Marked absent: ${timetable.userId}`,
        );
        absenceCount++;
      }
    }

    console.log(`[ABSENCE-CRON-JOB] Absence detection completed. Total absent: ${absenceCount}`);
  } catch (err) {
    console.error("[ABSENCE-CRON-JOB] Absence cron error:", err);
  }
});
