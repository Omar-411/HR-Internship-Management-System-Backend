import Task from "../../models/Task.js";

// For each team member, we get his task stats
export const getUserTaskStats = async (userId, projectId) => {
  const stats = await Task.aggregate([
    {
      $match: {
        assignedTo: userId,
        projectId: projectId,
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  // Convert array → object
  const formatted = {
    totalTasks: 0,
    backlog: 0,
    todo: 0,
    inProgress: 0,
    review: 0,
    done: 0,
  };

  stats.forEach((s) => {
    formatted.totalTasks += s.count;

    if (s._id === "Backlog") formatted.backlog = s.count;
    if (s._id === "To Do") formatted.todo = s.count;
    if (s._id === "In Progress") formatted.inProgress = s.count;
    if (s._id === "Review") formatted.review = s.count;
    if (s._id === "Done") formatted.done = s.count;
  });

  const completionRate =
    formatted.totalTasks === 0
      ? 0
      : (formatted.done / formatted.totalTasks) * 100;

  return {
    ...formatted,
    completionRate,
  };
};
