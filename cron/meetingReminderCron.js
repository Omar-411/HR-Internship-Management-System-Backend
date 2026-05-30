import cron from "node-cron";
import Meeting from "../models/Meeting.js";
import Project from "../models/Project.js";
import { createNotification } from "../services/notificationService.js";

// Runs every minute to check for upcoming meetings and send reminders
cron.schedule("* * * * *", async () => {
  console.log("[MEETING-REMINDER-CRON] Running meeting reminder cron...");

  try {
    const now = new Date();

    // Get the scheduled meetings only
    const meetings = await Meeting.find({
      status: "Scheduled",
      reminderSent: false,
    }).populate("projectId", "name");

    for (const meeting of meetings) {
      // Build meeting start datetime
      const meetingStart = new Date(meeting.date);

      const [hours, minutes] = meeting.startTime.split(":");

      meetingStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Reminder datetime
      const reminderTime = new Date(
        meetingStart.getTime() -
          meeting.reminderMinutesBefore * 60 * 1000,
      );

      // If reminder time reached
      if (now >= reminderTime && now < meetingStart) {
        for (const attendee of meeting.attendees) {
          // Skip the rejected attendees
          if (attendee.status === "Rejected") continue;

          await createNotification({
            recipientId: attendee.userId,
            type: "MEETING",
            title: "Meeting Reminder",
            message: `Reminder: "${meeting.title}" starts in ${meeting.reminderMinutesBefore} minutes.`,
            data: {
              entityType: "MEETING",
              entityId: null,
            },
          });
        }

        // Prevent the duplicate reminders
        meeting.reminderSent = true;

        await meeting.save();

        console.log(
          `[MEETING-REMINDER-CRON] Meeting Reminder sent for meeting: ${meeting.title}.`,
        );
      }
    }
  } catch (err) {
    console.error("[MEETING-REMINDER-CRON] Meeting Reminder Error:", err);
  }
});
