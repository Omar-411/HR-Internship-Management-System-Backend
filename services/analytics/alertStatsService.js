// services/analytics/alertStatsService.js

import Alert from "../../models/Alert.js";
import {
  getStartAndEndOfToday,
  getMonthRange,
} from "../../utils/timeHelpers.js";

// Admin dashboard alert overview stats (monthly and daily alert breakdown)
export const getAdminDashboardAlertStats = async () => {
  const now = new Date();

  // Today boundaries
  const { start: startOfToday, end: startOfTomorrow } =
    getStartAndEndOfToday();

  // Yesterday boundaries
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  // Current month boundaries
  const { monthStart: startOfMonth } = getMonthRange(
    now.getFullYear(),
    now.getMonth() + 1,
  );

  const stats = await Alert.aggregate([
    {
      $match: {
        recipientType: "HR_DEPARTMENT",
      },
    },
    {
      $facet: {
        // Alerts this month
        currentMonth: [
          {
            $match: {
              createdAt: { $gte: startOfMonth },
            },
          },
          {
            $count: "count",
          },
        ],

        // Alerts today
        today: [
          {
            $match: {
              createdAt: {
                $gte: startOfToday,
                $lt: startOfTomorrow,
              },
            },
          },
          {
            $group: {
              _id: null, 
              totalToday: { $sum: 1 },

              // By type
              technicalToday: {
                $sum: {
                  $cond: [{ $eq: ["$alertType", "TECHNICAL"] }, 1, 0],
                },
              },
              behavioralToday: {
                $sum: {
                  $cond: [{ $eq: ["$alertType", "BEHAVIORAL"] }, 1, 0],
                },
              },

              // By status
              newToday: {
                $sum: {
                  $cond: [{ $eq: ["$status", "NEW"] }, 1, 0],
                },
              },
              underReviewToday: {
                $sum: {
                  $cond: [{ $eq: ["$status", "UNDER_REVIEW"] }, 1, 0],
                },
              },
              resolvedToday: {
                $sum: {
                  $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0],
                },
              },
              dismissedToday: {
                $sum: {
                  $cond: [{ $eq: ["$status", "DISMISSED"] }, 1, 0],
                },
              },
            },
          },
        ],

        // Alerts yesterday (for comparison)
        yesterday: [
          {
            $match: {
              createdAt: {
                $gte: startOfYesterday,
                $lt: startOfToday,
              },
            },
          },
          {
            $count: "count",
          },
        ],
      },
    },
  ]);

  // Safe extraction
  const currentMonthAlerts = stats[0].currentMonth[0]?.count || 0;

  const today = stats[0].today[0] || {
    totalToday: 0,
    technicalToday: 0,
    behavioralToday: 0,
    newToday: 0,
    underReviewToday: 0,
    resolvedToday: 0,
    dismissedToday: 0,
  };

  const yesterdayCount = stats[0].yesterday[0]?.count || 0;

  // Difference compared to yesterday
  const rawDifference = today.totalToday - yesterdayCount;

  const formattedDifference =
    rawDifference > 0 ? `+${rawDifference}` : rawDifference.toString();

  return {
    currentMonth: {
      totalAlerts: currentMonthAlerts,
    },
    today: {
      totalAlerts: today.totalToday,
      differenceFromYesterday: formattedDifference,
      byType: {
        technical: today.technicalToday,
        behavioral: today.behavioralToday,
      },
      byStatus: {
        new: today.newToday,
        underReview: today.underReviewToday,
        resolved: today.resolvedToday,
        dismissed: today.dismissedToday,
      },
    },
  };
};

// Global alert KPIs for the alert section of the Admin dashboard
export const getAlertKPIs = async () => {
  const stats = await Alert.aggregate([
    {
      $match: {
        recipientType: "HR_DEPARTMENT",
      },
    },
    {
      $group: {
        _id: null,
        totalAlerts: { $sum: 1 },

        newAlerts: {
          $sum: {
            $cond: [{ $eq: ["$status", "NEW"] }, 1, 0],
          },
        },

        underReviewAlerts: {
          $sum: {
            $cond: [{ $eq: ["$status", "UNDER_REVIEW"] }, 1, 0],
          },
        },

        resolvedAlerts: {
          $sum: {
            $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0],
          },
        },

        dismissedAlerts: {
          $sum: {
            $cond: [{ $eq: ["$status", "DISMISSED"] }, 1, 0],
          },
        },
      },
    },
  ]);

  const global = stats[0] || {
    totalAlerts: 0,
    newAlerts: 0,
    underReviewAlerts: 0,
    resolvedAlerts: 0,
    dismissedAlerts: 0,
  };

  return {
    status: "Success",
    code: 200,
    message: "Admin Alert KPIs retrieved successfully!",
    data: {
      global,
    },
  };
};
