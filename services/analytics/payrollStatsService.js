import Payroll from "../../models/Payroll.js";
import User from "../../models/User.js";
import Department from "../../models/Department.js";
import AppError from "../../utils/AppError.js";

// Get monthly net payout trend for the last 6 months
export const getPayrollTrend = async () => {
  const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const now = new Date();

  // Build the last 6 months payrolls
  const months = [];
  for (let i = 5; i >= 0; i--) {
    // Calculate the month and year for each of the last 6 months
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    
    // Push the month and year to the array
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const trend = await Promise.all(
    months.map(async ({ year, month }) => {
      // Aggregate the total net payout for the month
      const result = await Payroll.aggregate([
        { $match: { year, month } },
        { $group: { _id: null, netPayout: { $sum: "$netSalary" } } },
      ]);

      return {
        month: MONTH_NAMES[month - 1],
        netPayout: result[0]?.netPayout ?? 0,
      };
    }),
  );

  return { 
    status: "Success", 
    message: "6-Monthly net payout trend retrieved successfully.",
    code: 200, 
    data: trend 
  };
};

// Get net payout aggregated by department for a given month/year
export const getPayrollByDepartment = async (queryParams) => {
  const now = new Date();
  const month = parseInt(queryParams?.month) || now.getMonth() + 1;
  const year = parseInt(queryParams?.year) || now.getFullYear();

  const result = await Payroll.aggregate([
    { $match: { month, year } },
    {
      $lookup: {
        from: "users",
        localField: "employeeId",
        foreignField: "_id",
        as: "employee",
      },
    },
    { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "departments",
        localField: "employee.department_id",
        foreignField: "_id",
        as: "department",
      },
    },
    { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ["$department.name", "Unknown"] },
        netPayout: { $sum: "$netSalary" },
      },
    },
    {
      $project: {
        _id: 0,
        department: "$_id",
        netPayout: 1,
      },
    },
    { $sort: { netPayout: -1 } },
  ]);

  return { 
    status: "Success", 
    message: `Net payout by department for ${month}/${year} retrieved successfully.`,
    code: 200, 
    data: result 
  };
};
