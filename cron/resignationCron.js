import cron from "node-cron";
import Resignation from "../models/Resignation.js";
import User from "../models/User.js";
import Task from "../models/Task.js";

// Runs every day at midnight
cron.schedule("0 0 * * *", async () => {
  console.log("Running resignation cron job...");

  // Get the current date and time
  const now = new Date();

  try {
    // Move scheduled_exit → inactive + deactivate user if the exit date has passed
    const toDeactivate = await Resignation.find({
      status: "scheduled_exit",
      exitDate: { $lte: now },
    });

    for (const resignation of toDeactivate) {
      // Update resignation + save the changes
      resignation.status = "inactive";
      await resignation.save();

      // Deactivate the user automatically
      await User.findByIdAndUpdate(resignation.employeeId, {
        status: "Inactive",
      });

      // Unassign unfinished tasks of the employee
      await Task.updateMany(
        {
          assignedTo: resignation.employeeId,
          status: { $ne: "Done" },
        },
        {
          $set: {
            assignedTo: null,
          },
        },
      );

      // Remove supervisor reference from all employees supervised by this user (In case: Supervisor)
      await User.updateMany(
        { supervisor_id: resignation.employeeId },
        {
          $set: {
            supervisor_id: null,
          },
        },
      );
    }

    console.log(`Moved to inactive: ${toDeactivate.length}`);
  } catch (err) {
    console.error("Cron job error:", err);
  }
});
