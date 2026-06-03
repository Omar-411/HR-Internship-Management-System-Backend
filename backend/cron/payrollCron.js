import cron from "node-cron";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Payroll from "../models/Payroll.js";
import PayrollConfig from "../models/PayrollConfig.js";
import { calculatePayroll } from "../services/payrollService.js";
import { createNotificationForAdmins } from "../utils/notificationHelpers.js";
import AppError from "../utils/AppError.js";

// Runs every month on the 1st at 00:10 AM to generate draft payrolls for each employee for the previous month
cron.schedule("10 0 1 * *", async () => {
  console.log("[CRON] Starting monthly payroll generation...");

  try {
    // Get the previous month and the adequate year
    const now = new Date();
    const month = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1;
    const year =
      now.getUTCMonth() === 0
        ? now.getUTCFullYear() - 1
        : now.getUTCFullYear();

    // Check active payroll configuration FIRST
    const config = await PayrollConfig.findOne({
      year,
      isActive: true,
    });

    if (!config) {
      console.log(
        `[PAYROLL-CRON] No active payroll configuration found for ${year}.`,
      );

      // Notify all admins about the missing configuration and the aborted payroll generation
      try {
        await createNotificationForAdmins({
          type: "PAYROLL_CONFIG",
          title: `Missing an active Payroll Configuration for the year ${year}`,
          message: `No active payroll configuration exists for ${year}. Monthly payroll generation was aborted.`,
          data: {
            entityType: null,
            entityId: null,
          },
        });
      } catch (notificationError) {
        console.error(
          "[PAYROLL-CRON] Failed to notify admins:",
          notificationError.message,
        );
      }

      // Stop the cron job
      return;
    }

    // Fetch the Intern role
    const internRole = await UserRole.findOne({ name: "Intern" });

    // Fetch active non-intern users
    const users = await User.find({
      status: "Active",
      role_id: { $ne: internRole?._id },
    });

    if (!users.length) {
      console.log("[PAYROLL-CRON] No eligible users found for the monthly payroll generation.");
      return;
    }

    // Process each user for the payroll generation
    for (const user of users) {
      try {
        await calculatePayroll(user._id, month, year, config);

        console.log(
          `[PAYROLL-CRON] Payroll created for ${user.name} ${user.lastName}`,
        );
      } catch (err) {
        console.error(
          `[PAYROLL-CRON] Error processing ${user.name} ${user.lastName}:`,
          err.message,
        );

        // Pass to the next user
        continue;
      }
    }

    // Send a notification to all admins about the completion of the payroll generation
    try {
      await createNotificationForAdmins({
        type: "PAYROLL",
        title: `Monthly Payroll Generation Completed for ${month + 1}/${year}`,
        message: `The monthly payroll generation process for ${month + 1}/${year} has been completed. Please review the generated payroll records and validate them as needed.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (notificationError) {
      console.error(
        "[PAYROLL-CRON] Failed to notify admins about payroll generation completion:",
        notificationError.message,
      );
    }

    console.log("[PAYROLL-CRON] Monthly payroll generation completed.");
  } catch (err) {
    console.error("[PAYROLL-CRON] Fatal error:", err.message);
  }
});
