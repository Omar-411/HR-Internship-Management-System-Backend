import mongoose from "mongoose";

const employeeBonusSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    bonusTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BonusType",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    effectiveFrom: {
      type: Date,
      required: true,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicates for same employee bonus type in same period
employeeBonusSchema.index(
  { userId: 1, bonusTypeId: 1, effectiveFrom: 1 },
  { unique: true }
);

export default mongoose.model("EmployeeBonus", employeeBonusSchema);
