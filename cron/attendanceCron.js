import cron from "node-cron";
import Attendance from "../models/Attendance.js";
import Timetable from "../models/Timetable.js";

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

    // Get all today's working timetables
    const timetables = await Timetable.find({
      date: { $gte: today, $lt: tomorrow },
      type: { $ne: "Day Off" },
    });

    for (const timetable of timetables) {
      // Skip public holidays
      if (timetable.isPublicHoliday) {
        continue;
      }

      // Check if an attendance already exists for the employee that day (Check-in, day-off, leave)
      const existingAttendance = await Attendance.findOne({
        userId: timetable.userId,
        date: { $gte: today, $lt: tomorrow },
      });

      if (existingAttendance) {
        continue;
      }

      // Extract the hours and minutes from the timetable's endTime (e.g., "17:00")
      const [hours, minutes] = timetable.endTime.split(":");

      // Create a Date object for the shift end time on the timetable's date
      const shiftEnd = new Date(timetable.date);

      // Set the hours and minutes for the shift end time in UTC
      shiftEnd.setUTCHours(Number(hours), Number(minutes), 0, 0);

      // If shift has ended and employee never checked in
      if (now > shiftEnd) {
        await Attendance.create({
          userId: timetable.userId,
          date: today,
          status: "absent",
        });

        console.log(`[ABSENCE-CRON-JOB] Marked absent: ${timetable.userId}`);
      }
    }

    console.log("[ABSENCE-CRON-JOB] Absence detection completed.");
  } catch (err) {
    console.error("[ABSENCE-CRON-JOB] Absence cron error:", err);
  }
});
