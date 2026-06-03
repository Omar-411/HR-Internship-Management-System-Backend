import User from "../models/User.js";
import Task from "../models/Task.js";
import Payroll from "../models/Payroll.js";

// Helper function to refresh the exit summary of a resignation request whenever there is a relevant change
export const refreshExitSummary = async (resignation) => {
  if (
    !resignation ||
    !["approved", "scheduled_exit", "inactive"].includes(resignation.status)
  ) {
    return resignation;
  }

  const employee = await User.findById(resignation.employeeId).populate(
    "leaveBalances.typeId",
    "name",
  );
  if (!employee) return resignation;

  // Get a preview of pending tasks (limit to 3) + total count of pending tasks
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

  // Calculate remaining leave days by summing up the remainingDays of the annual leave type from the employee's leaveBalances
  const remainingLeaveDays = (employee.leaveBalances || [])
    .filter(
      (b) => b.typeId?.name?.toLowerCase() === "annual leave"
    )
    .reduce((sum, b) => sum + b.remainingDays, 0);

  // Calculate the final salary
  const payroll = await Payroll.findOne({
    employeeId: employee._id,
    month: resignation.exitDate.getMonth(),
    year: resignation.exitDate.getFullYear(),
  });

  const finalSalary = payroll?.netSalary || employee.salary?.base || 0;

  // Update the resignation's exit summary with the latest data
  resignation.exitSummary = {
    finalSalary,
    pendingTasksCount,
    remainingLeaveDays,
    taskPreview: pendingTasks.map((t) => t.title),
  };

  await resignation.save();

  return resignation;
};
