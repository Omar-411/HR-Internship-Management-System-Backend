import Resignation from "../../models/Resignation.js";

// Get resignation KPIs for the admin dashboard in the Resignation section
export const getResignationKPIs = async () => {
  const result = await Resignation.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  // Normalize the output 
  const stats = {
    submitted: 0,
    approved: 0,
    scheduled_exit: 0,
  };

  result.forEach((item) => {
    if (item._id === "submitted") stats.submitted = item.count;
    if (item._id === "approved") stats.approved = item.count;
    if (item._id === "scheduled_exit") stats.scheduled_exit = item.count;
  });

  return {
    status: "Success",
    code: 200,
    message: "Resignation KPIs retrieved successfully!",
    data: stats,
  };
};
