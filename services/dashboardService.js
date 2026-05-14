import mongoose from "mongoose";
import User from "../models/User.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Attendance from "../models/Attendance.js";
import Timetable from "../models/Timetable.js";
import UserRole from "../models/UserRole.js";

// Get Dashboard data for supervisors
export const getSupervisorDashboard = async (user) => {
  const userId = user.id || user._id;
  const supervisorId = new mongoose.Types.ObjectId(userId);

  // 1. Get Team Members
  const teamMembers = await User.find({ supervisor_id: supervisorId }).select("name _id publicId");
  const teamMemberIds = teamMembers.map(m => m._id);

  // 2. Get Supervisor's Projects
  const projects = await Project.find({ productOwnerId: supervisorId }).select("_id status name");
  const projectIds = projects.map(p => p._id);

  // 3. Get Task Stats for these projects
  const tasks = await Task.find({ projectId: { $in: projectIds } }).select("status assignedTo completedAt updatedAt title");

  // --- Compute Stats ---

  // Project Summary
  const projectSummary = {
    total: projects.length,
    done: projects.filter(p => p.status === "Completed").length,
    atRisk: projects.filter(p => p.status === "On Hold").length, // Simple at-risk logic
    value: tasks.length === 0 ? 0 : Math.round((tasks.filter(t => t.status === "Done").length / tasks.length) * 100)
  };

  // Tasks Overview
  const tasksOverview = {
    todo: tasks.filter(t => ["Backlog", "To Do"].includes(t.status)).length,
    inProgress: tasks.filter(t => ["In Progress", "Review"].includes(t.status)).length,
    done: tasks.filter(t => t.status === "Done").length
  };

  // Activities (Recent updates)
  const activities = tasks
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5)
    .map(t => {
      const assignee = teamMembers.find(m => String(m._id) === String(t.assignedTo));
      const name = assignee ? assignee.name : "System";
      return {
        id: t._id,
        name: name,
        initials: name.split(" ").map(n => n[0]).join("").toUpperCase(),
        avatarColor: `hsl(${(name.charCodeAt(0) * 47) % 360}, 70%, 50%)`,
        action: `Updated task: ${t.title}`,
        createdAt: t.updatedAt
      };
    });

  // Completion by User (Includes everyone in team)
  const completionByUser = teamMembers.map(member => {
    const completedCount = tasks.filter(t => String(t.assignedTo) === String(member._id) && t.status === "Done").length;
    return {
      userId: member.publicId || member._id,
      name: member.name,
      initials: member.name.split(" ").map(n => n[0]).join("").toUpperCase(),
      completed: completedCount
    };
  });

  return {
    status: "Success",
    code: 200,
    message: "Supervisor dashboard retrieved successfully",
    data: {
      projectSummary,
      tasksOverview,
      activities,
      completionByUser,
    },
  };
};

// Get Dashboard data for Admins
export const getAdminDashboard = async (user) => {
  // 1. User Roles lookup
  const employeeRole = await UserRole.findOne({ name: { $regex: /^employee$/i } });
  const internRole = await UserRole.findOne({ name: { $regex: /^intern$/i } });

  // 2. Counts
  const [
    totalEmployees,
    totalInterns,
    activeUsers,
    inactiveUsers,
    ongoingProjects
  ] = await Promise.all([
    User.countDocuments({ role_id: employeeRole?._id }),
    User.countDocuments({ role_id: internRole?._id }),
    User.countDocuments({ status: "Active" }),
    User.countDocuments({ status: { $ne: "Active" } }),
    Project.countDocuments({ status: { $in: ["Active", "Planning"] } })
  ]);

  // 3. Attendance Trends (Last 6 Months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [attendanceStats, timetableStats] = await Promise.all([
    Attendance.aggregate([
      { $match: { date: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { month: { $month: "$date" }, year: { $year: "$date" } },
          present: { $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] } }
        }
      }
    ]),
    Timetable.aggregate([
      { $match: { date: { $gte: sixMonthsAgo }, type: { $ne: "Day Off" } } },
      {
        $group: {
          _id: { month: { $month: "$date" }, year: { $year: "$date" } },
          expected: { $sum: 1 }
        }
      }
    ])
  ]);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const statsMap = new Map();

  // Initialize with last 6 months to ensure continuity
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const key = `${y}-${m}`;
    statsMap.set(key, { month: m, year: y, present: 0, expected: 0 });
  }

  attendanceStats.forEach(s => {
    const key = `${s._id.year}-${s._id.month}`;
    if (statsMap.has(key)) statsMap.get(key).present = s.present;
  });
  timetableStats.forEach(s => {
    const key = `${s._id.year}-${s._id.month}`;
    if (statsMap.has(key)) statsMap.get(key).expected = s.expected;
  });

  const attendanceTrends = Array.from(statsMap.values())
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map(s => {
      // Use Timetable 'expected' as baseline; fallback to Attendance 'present' count if no schedule exists
      const totalBaseline = s.expected > 0 ? s.expected : s.present;
      return {
        month: monthNames[s.month - 1],
        attendance: totalBaseline === 0 ? 0 : Math.round((s.present / totalBaseline) * 100),
        target: 95
      };
    });

  // Overall Avg Attendance Rate (Weighted)
  const totalPresentAll = Array.from(statsMap.values()).reduce((acc, s) => acc + s.present, 0);
  const totalExpectedAll = Array.from(statsMap.values()).reduce((acc, s) => acc + (s.expected > 0 ? s.expected : s.present), 0);
  const avgAttendanceRate = totalExpectedAll === 0 ? 0 : parseFloat(((totalPresentAll / totalExpectedAll) * 100).toFixed(1));

  // 4. Today's Attendance Distribution
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [dailyAttendance, dailyTimetable] = await Promise.all([
    Attendance.find({ date: { $gte: startOfToday, $lt: endOfToday } }).select("userId status workLocation"),
    Timetable.find({ date: { $gte: startOfToday, $lt: endOfToday }, type: { $ne: "Day Off" } }).select("userId")
  ]);

  const distributionMap = { Present: 0, Remote: 0, Absent: 0, "On Leave": 0 };
  const checkedInUserIds = new Set();

  dailyAttendance.forEach(a => {
    checkedInUserIds.add(a.userId.toString());
    const status = a.status;
    const loc = a.workLocation;

    if (status === "present" || status === "late") {
      if (loc === "Remote") distributionMap["Remote"] += 1;
      else distributionMap["Present"] += 1;
    } else if (status === "absent") {
      distributionMap["Absent"] += 1;
    } else if (status === "leave") {
      distributionMap["On Leave"] += 1;
    }
  });

  // Count users who are scheduled but haven't checked in (and have no attendance record yet)
  dailyTimetable.forEach(t => {
    if (!checkedInUserIds.has(t.userId.toString())) {
      distributionMap["Absent"] += 1;
    }
  });

  const attendanceDistribution = Object.entries(distributionMap).map(([name, value]) => ({ name, value }));

  return {
    status: "Success",
    code: 200,
    message: "Admin dashboard retrieved successfully",
    data: {
      kpis: {
        totalEmployees,
        totalInterns,
        activeUsers,
        inactiveUsers,
        ongoingProjects,
        avgAttendanceRate,
      },
      attendanceTrends,
      attendanceDistribution,
    },
  };
};

// Get Dashboard data for Individual Users (Employee/Intern)
export const getDashboardStats = async (user) => {
  const userId = user.id || user._id;

  // Fetch all tasks for the user
  const tasks = await Task.find({ assignedTo: userId });

  const now = new Date();
  
  // Calculate Monday of the current week
  const currentDay = now.getDay();
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay; // If Sunday, go back 6 days, else back to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  let tasksThisWeekCount = 0;
  
  const overdueCounts = { todo: 0, inProgress: 0, stuck: 0 };
  let completedCount = 0;
  const totalTasks = tasks.length;
  
  // For weekly productivity: days of the week (0=Mon, 1=Tue, ..., 6=Sun)
  const completedThisWeekByDay = [0, 0, 0, 0, 0, 0, 0];
  
  const statusCounts = { todo: 0, inProgress: 0, done: 0, stuck: 0 };
  
  // Avg completion time: last 6 weeks
  const msInDay = 24 * 60 * 60 * 1000;
  const msInWeek = 7 * msInDay;
  const weekStartDates = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(monday.getTime() - (i * msInWeek));
    weekStartDates.push(d);
  }
  const weeklyCompletionStats = Array.from({ length: 6 }, () => ({ totalDays: 0, count: 0 }));

  tasks.forEach((t) => {
    const s = (t.status || "").toLowerCase();
    
    // Status normalization for counts
    if (s === "done" || s === "approved") {
      statusCounts.done++;
      completedCount++;
      
      // Tasks this week logic
      if (t.completedAt) {
        const compAt = new Date(t.completedAt);
        if (compAt >= monday && compAt <= now) {
          tasksThisWeekCount++;
          // For weekly productivity
          // Sunday is 0 in JS, so normalize: Mon=0, Tue=1, ..., Sun=6
          const jsDay = compAt.getDay();
          const normDay = jsDay === 0 ? 6 : jsDay - 1;
          completedThisWeekByDay[normDay]++;
        }
        
        // For Avg Completion Time
        if (t.createdAt) {
          const compTime = compAt.getTime();
          // Find which week it belongs to
          for (let i = 0; i < 6; i++) {
            const wStart = weekStartDates[i].getTime();
            const wEnd = wStart + msInWeek - 1;
            if (compTime >= wStart && compTime <= wEnd) {
              const daysDiff = (compTime - new Date(t.createdAt).getTime()) / msInDay;
              weeklyCompletionStats[i].totalDays += daysDiff;
              weeklyCompletionStats[i].count++;
              break;
            }
          }
        }
      }
    } else if (s === "to do" || s === "todo" || s === "backlog") {
      statusCounts.todo++;
    } else if (s === "in progress" || s === "in_progress") {
      statusCounts.inProgress++;
    } else if (s === "review" || s === "blocked" || s === "stuck") {
      statusCounts.stuck++;
    } else {
      statusCounts.todo++;
    }
    
    // Overdue logic
    if (t.dueDate) {
      const due = new Date(t.dueDate);
      if (due < now && s !== "done" && s !== "approved") {
        if (s === "to do" || s === "todo" || s === "backlog") overdueCounts.todo++;
        else if (s === "in progress" || s === "in_progress") overdueCounts.inProgress++;
        else overdueCounts.stuck++;
      }
    }
  });

  const overdueByStatus = [
    { status: "todo", count: overdueCounts.todo },
    { status: "inProgress", count: overdueCounts.inProgress },
    { status: "stuck", count: overdueCounts.stuck }
  ];
  
  // Calculate weekly productivity bands
  // Bands: low (0-3), medium (4-6), high (7+)
  let low = 0, medium = 0, high = 0;
  // Only calculate up to current day (if today is Wed (2), we look at 0, 1, 2)
  const daysPassed = currentDay === 0 ? 7 : currentDay;
  for (let i = 0; i < daysPassed; i++) {
    const c = completedThisWeekByDay[i];
    if (c <= 3) low++;
    else if (c <= 6) medium++;
    else high++;
  }
  
  let lowPct = 0, medPct = 0, highPct = 0;
  if (daysPassed > 0) {
    lowPct = Math.round((low / daysPassed) * 100);
    medPct = Math.round((medium / daysPassed) * 100);
    highPct = 100 - lowPct - medPct;
  }
  const weeklyProductivity = [lowPct, medPct, highPct];
  
  const tasksByStatus = [
    { name: "Todo", amount: statusCounts.todo },
    { name: "In Progress", amount: statusCounts.inProgress },
    { name: "Done", amount: statusCounts.done },
    { name: "Stuck", amount: statusCounts.stuck }
  ];
  
  const avgCompletionTime = weeklyCompletionStats.map((stat, idx) => {
    return {
      week: `Week ${idx + 1}`,
      avgDays: stat.count > 0 ? parseFloat((stat.totalDays / stat.count).toFixed(1)) : 0
    };
  });

  return {
    tasksThisWeek: tasksThisWeekCount,
    tasksThisWeekGoal: 10,
    overdueByStatus,
    completionRate: { completed: completedCount, total: totalTasks },
    weeklyProductivity,
    tasksByStatus,
    avgCompletionTime
  };
};
