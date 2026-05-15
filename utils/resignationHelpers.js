import User from "../models/User.js";
import Task from "../models/Task.js";

export const refreshExitSummary = async (resignation) => {
  if (!resignation || !["approved", "scheduled_exit", "inactive"].includes(resignation.status)) {
    return resignation;
  }

  const employee = await User.findById(resignation.employeeId);
  if (!employee) return resignation;

  const pendingTasks = await Task.find({
    assignedTo: resignation.employeeId,
    status: { $ne: "Done" },
  })
    .select("title")
    .limit(3);

  const pendingTasksCount = await Task.countDocuments({
    assignedTo: resignation.employeeId,
    status: { $ne: "Done" },
  });

  const remainingLeaveDays = (employee.leaveBalances || []).reduce(
    (sum, b) => sum + b.remainingDays,
    0,
  );

  resignation.exitSummary = {
    finalSalary: employee.salary?.base || 0,
    pendingTasksCount,
    remainingLeaveDays,
    taskPreview: pendingTasks.map((t) => t.title),
  };

  await resignation.save();
  return resignation;
};
