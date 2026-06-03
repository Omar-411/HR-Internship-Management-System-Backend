import mongoose from "mongoose";

const allowanceTypeSchema = new mongoose.Schema(
  {
    code: {
      // A unique code to identify the allowance type (e.g., "TRANSPORT", "MEAL", "HOUSING")
      type: String,
      required: true,
      unique: true,
    },
    name: {
      // E.g., "Transport Allowance", "Meal Allowance", "Housing Allowance"
      type: String,
      required: true,
    },
    isTaxable: {
      // Whether the allowance is subject to income tax (IRPP) and social contributions (CNSS)
      type: Boolean,
      default: false,
    },
    defaultAmount: {
      type: Number,
      default: 0,
    },
    active: {
      // Whether the allowance type is active and can be used in payroll calculations
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("AllowanceType", allowanceTypeSchema);
