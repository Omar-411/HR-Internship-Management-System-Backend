import express from "express";
import {
  createAllowanceType,
  toggleAllowanceTypeActivation,
  getAllAllowanceTypes,
  getAllowanceTypeById,
  updateAllowanceType,
} from "../controllers/allowanceTypeController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Route to create a new allowance type (Admin only)
router.post(
  "/allowance-types",
  authenticate,
  authorize(["Admin"]),
  createAllowanceType,
);

// Route to toggle the activation status of an allowance type (Admin only)
router.patch(
  "/allowance-types/:id/toggle",
  authenticate,
  authorize(["Admin"]),
  toggleAllowanceTypeActivation,
);

// Route to get all allowance types (Admin only)
router.get(
  "/allowance-types",
  authenticate,
  authorize(["Admin"]),
  getAllAllowanceTypes,
);

// Route to get an allowance type by Id (Admin only)
router.get(
  "/allowance-types/:id",
  authenticate,
  authorize(["Admin"]),
  getAllowanceTypeById,
);

// Route to update an allowance type (Admin only)
router.patch(
  "/allowance-types/:id",
  authenticate,
  authorize(["Admin"]),
  updateAllowanceType,
);

export default router;
