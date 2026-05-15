import cron from "node-cron";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Payroll from "../models/Payroll.js";
import { calculatePayroll } from "../services/payrollService.js";
import AppError from "../utils/AppError.js";

// Runs every month on the 1st at 00:10 AM to generate draft payrolls for each employee
cron.schedule("10 0 1 * *", async () => {
  console.log("[CRON] Starting monthly payroll generation...");

  try {
    // Get previous month
    const now = new Date();
    const month = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1;
    const year =
      now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();

    // Fetch the Intern role
    const internRole = await UserRole.findOne({ name: "Intern" });

    // Fetch the active users (Exclude the Interns since they don't have payroll)
    const users = await User.find({
      status: "Active",
      role_id: { $ne: internRole?._id },
    });

    if (!users.length) {
      console.log("[CRON] No users found.");
      return;
    }

    for (const user of users) {
      try {
        // Compute payroll snapshot
        const computed = await calculatePayroll(
          user._id,
          month,
          year,
        );

        console.log(`[CRON] Payroll created for ${user.name} ${user.lastName}`);
      } catch (err) {
        console.error(`[CRON] Error processing user ${user._id}:`, err.message);
      }
    }

    console.log("[CRON] Monthly payroll generation completed.");
  } catch (err) {
    console.error("[CRON] Fatal error:", err);
  }
});
