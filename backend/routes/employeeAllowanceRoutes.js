import express from "express";
import {
  assignAllowanceToEmployee,
  toggleEmployeeAllowanceActivation,
  getAllEmployeeAllowances,
  updateEmployeeAllowance,
  getEmployeeAllowanceById,
  getEmployeeAllowances,
} from "../controllers/employeeAllowanceController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Assign an allowance to an employee
router.post(
  "/employee-allowances/assign",
  authenticate,
  authorize(["Admin"]),
  assignAllowanceToEmployee,
);

// Toggle the active status of an employee allowance
router.patch(
  "/employee-allowances/:id/toggle",
  authenticate,
  authorize(["Admin"]),
  toggleEmployeeAllowanceActivation,
);

// Get all employee allowances
router.get(
  "/employee-allowances",
  authenticate,
  authorize(["Admin"]),
  getAllEmployeeAllowances,
);

// Get an employee's allowances
router.get(
  "/employees-allowances/employee/:id",
  authenticate,
  getEmployeeAllowances,
);

// Update an employee's allowance
router.patch(
  "/employee-allowances/:id",
  authenticate,
  authorize(["Admin"]),
  updateEmployeeAllowance,
);

// Get an employee allowance by ID
router.get(
  "/employee-allowances/:id",
  authenticate,
  getEmployeeAllowanceById,
);

export default router;
