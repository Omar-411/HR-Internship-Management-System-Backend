import mongoose from "mongoose";

const bonusTypeSchema = new mongoose.Schema(
  {
    code: {
      // A unique code to identify the bonus type (e.g., "PERFORMANCE", "ATTENDANCE", "HOLIDAY")
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    isTaxable: {
      // Whether the bonus is subject to income tax (IRPP) and social contributions (CNSS)
      type: Boolean,
      default: true,
    },
    defaultAmount: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("BonusType", bonusTypeSchema);
