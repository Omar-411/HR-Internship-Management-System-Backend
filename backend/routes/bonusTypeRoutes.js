import express from "express";
import {
  createBonusType,
  toggleBonusTypeActivation,
  getAllBonusTypes,
  getBonusTypeById,
  updateBonusType,
} from "../controllers/bonusTypeController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

// Route to create a new bonus type (Admin only)
router.post(
  "/bonus-types",
  authenticate,
  authorize(["Admin"]),
  createBonusType,
);

// Route to toggle the activation status of a bonus type (Admin only)
router.patch(
  "/bonus-types/:id/toggle",
  authenticate,
  authorize(["Admin"]),
  toggleBonusTypeActivation,
);

// Route to get all bonus types (Admin only)
router.get(
  "/bonus-types",
  authenticate,
  authorize(["Admin"]),
  getAllBonusTypes,
);

// Route to get a bonus type by Id (Admin only)
router.get(
  "/bonus-types/:id",
  authenticate,
  authorize(["Admin"]),
  getBonusTypeById,
);

// Route to update a bonus type (Admin only)
router.patch(
  "/bonus-types/:id",
  authenticate,
  authorize(["Admin"]),
  updateBonusType,
);

export default router;
