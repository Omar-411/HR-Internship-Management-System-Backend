import Payroll from "../../models/Payroll.js";
import User from "../../models/User.js";
import Department from "../../models/Department.js";
import AppError from "../../utils/AppError.js";

// Get payroll KPIs for the current month and year
export const getPayrollKPIs = async () => {
  // Detect the current month and year automatically
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Total net salaries for the current month
  const totalNetSalariesResult = await Payroll.aggregate([
    {
      $match: {
        month,
        year,
        status: { $in: ["validated", "paid"] }, 
      },
    },
    {
      $group: {
        _id: null,
        totalNetSalaries: { $sum: "$netSalary" },
      },
    },
  ]);

  // Total net salary grouped by department
  const salaryByDepartment = await Payroll.aggregate([
    {
      $match: {
        month,
        year,
        status: { $in: ["validated", "paid"] },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "employeeId",
        foreignField: "_id",
        as: "employee",
      },
    },
    {
      $unwind: "$employee",
    },
    {
      $lookup: {
        from: "departments",
        localField: "employee.department_id",
        foreignField: "_id",
        as: "department",
      },
    },
    {
      $unwind: {
        path: "$department",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: "$department.name",
        totalNetSalary: { $sum: "$netSalary" },
        employeesCount: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        department: { $ifNull: ["$_id", "No Department"] },
        totalNetSalary: 1,
        employeesCount: 1,
      },
    },
    {
      $sort: {
        totalNetSalary: -1,
      },
    },
  ]);

  // Convert month number to readable month name
  const period = now.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return {
    status: "Success",
    code: 200,
    message: "Payroll KPIs retrieved successfully!",
    data: {
      period,
      totalNetSalaries:
        totalNetSalariesResult[0]?.totalNetSalaries || 0,
      salaryByDepartment,
    },
  };
};
