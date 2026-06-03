import express from "express";
import {
  assignBonusToEmployee,
  toggleEmployeeBonusActivation,
  getAllEmployeeBonuses,
  updateEmployeeBonus,
  getEmployeeBonusById,
  getEmployeeBonuses,
} from "../controllers/employeeBonusController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Assign a bonus to an employee
router.post(
  "/employee-bonuses/assign",
  authenticate,
  authorize(["Admin"]),
  assignBonusToEmployee,
);

// Toggle the active status of an employee bonus
router.patch(
  "/employee-bonuses/:id/toggle",
  authenticate,
  authorize(["Admin"]),
  toggleEmployeeBonusActivation,
);

// Get all employee bonuses
router.get(
  "/employee-bonuses",
  authenticate,
  authorize(["Admin"]),
  getAllEmployeeBonuses,
);

// Update an employee's bonus
router.patch(
  "/employee-bonuses/:id",
  authenticate,
  authorize(["Admin"]),
  updateEmployeeBonus,
);

// Get an employee bonus by ID
router.get(
  "/employee-bonuses/:id",
  authenticate,
  getEmployeeBonusById,
);

// Get an employee's bonuses
router.get(
  "/employees-bonuses/employee/:id",
  authenticate,
  getEmployeeBonuses,
);

export default router;
