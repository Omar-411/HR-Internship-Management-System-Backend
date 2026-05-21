import cron from "node-cron";
import {
  generateDailyStats,
  generateMonthlyStats,
  generateTrimesterStats,
  generateYearlyStats,
} from "../services/attendanceStatsService.js";

// DAILY Stats -> Run Every day at 23:59
cron.schedule("59 23 * * *", async () => {
  console.log("Running daily attendance stats cron job...");

  try {
    await generateDailyStats();
    console.log("Daily attendance stats generated!");
  } catch (err) {
    console.error("Daily attendance stats error:", err);
  }
});

// MONTHLY -> 1st day of month at 00:05 (for previous month)
cron.schedule("5 0 1 * *", async () => {
  console.log("Running monthly attendance stats cron job...");

  try {
    const now = new Date();

    // Determine previous month and year
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 12 : now.getMonth(); // previous month

    await generateMonthlyStats(year, month);

    console.log(`Monthly attendance stats generated for ${month}/${year}`);
  } catch (err) {
    console.error("Monthly attendance stats error:", err);
  }
});

// TRIMESTER -> Every 3 months (Jan, Apr, Jul, Oct)
cron.schedule("10 0 1 1,4,7,10 *", async () => {
  console.log("Running trimester attendance stats job...");

  try {
    const now = new Date();

    // Determine previous trimester
    const month = now.getMonth() + 1; // 1 – 12 instead of 0 – 11
    let year = now.getFullYear();
    let trimester;

    // Get the previous trimester based on the current month
    if (month >= 1 && month <= 3) {
      trimester = 4;
      year -= 1;
    } else if (month >= 4 && month <= 6) {
      trimester = 1;
    } else if (month >= 7 && month <= 9) {
      trimester = 2;
    } else {
      trimester = 3;
    }

    // Generate stats for the previous trimester and year
    await generateTrimesterStats(year, trimester);

    console.log(`Trimester ${trimester} attendance stats generated for ${year}`);
  } catch (err) {
    console.error("Trimester attendance stats error:", err);
  }
});

// YEARLY -> Every Jan 1st at 00:15 (for previous year)
cron.schedule("15 0 1 1 *", async () => {
  console.log("Running yearly attendance stats job...");

  try {
    const year = new Date().getFullYear() - 1;

    await generateYearlyStats(year);

    console.log(`Yearly attendance stats generated for ${year}`);
  } catch (err) {
    console.error("Yearly attendance stats error:", err);
  }
});
