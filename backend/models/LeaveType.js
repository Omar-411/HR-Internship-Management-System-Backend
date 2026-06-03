import mongoose from "mongoose";

const leaveTypeSchema = mongoose.Schema(
  {
    name: {
      // Leave type name (e.g., Annual Leave, Sick Leave, Maternity Leave)
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
    },
    isPaid: {
      // Represents whether the leave type is paid or unpaid
      type: Boolean,
      default: true,
    },
    deductFrom: {
      // Represents which leave balance this leave type deducts from (e.g., annual, sick, maternity, etc.)
      type: String,
      enum: ["annual", "maternity", "paternity", "sick", "personal", "none"],
    },
    status: {
      // For the Archive/Restore functionality
      type: String,
      enum: ["Active", "Archived"],
      default: "Active",
    },
    defaultDays: {
      // Default number of days allocated for this leave type
      type: Number,
      required: true,
      min: 0,
    },
    maxDays: {
      // Maximum number of days allowed per request for this leave type
      type: Number,
      min: 0,
    },
    gender: {
      // User gender eligibility for this leave type (e.g., maternity leave for mothers)
      type: String,
      enum: ["Male", "Female", "Both"],
      default: "Both",
    },
    requiresChildBirth: {
      // Indicates if the leave type is specifically for childbirth (e.g., maternity/paternity leave)
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("LeaveType", leaveTypeSchema);
