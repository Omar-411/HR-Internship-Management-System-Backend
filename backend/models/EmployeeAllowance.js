import mongoose from "mongoose";

const employeeAllowanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Index for faster lookups of allowances by user
    },
    allowanceTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AllowanceType",
      required: true,
    },
    amount: {
      // The Admin can override the default amount from the AllowanceType when assigning it to an employee
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      // Whether the allowance is currently active for the employee. Inactive allowances are ignored in payroll calculations
      type: Boolean,
      default: true,
    },
    effectiveFrom: {
      // The date from which the allowance is effective for the employee
      type: Date,
      required: true,
    },
    effectiveTo: {
      // The date until which the allowance is effective for the employee. If null, it means the allowance is still active 
      type: Date,
      default: null, // null = Still active
    },
  },
  { timestamps: true }
);

// Prevent duplicate active allowance of same type for same user at same time
employeeAllowanceSchema.index(
  { userId: 1, allowanceTypeId: 1, effectiveFrom: 1 },
  { unique: true }
);

export default mongoose.model("EmployeeAllowance", employeeAllowanceSchema);
