import mongoose from "mongoose";

const attendanceSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      // The date of the attendance record
      type: Date,
      required: true,
    },
    checkInTime: {
      // The time the user checked in
      type: String,
    },
    checkOutTime: {
      // The time the user checked out
      type: String,
    },
    status: {
      type: String,
      enum: ["present", "late", "absent", "leave", "day-off"],
      default: "absent",
    },
    workLocation: {
      type: String,
      enum: ["Remote", "Onsite"],
    },
    location: {
      latitude: Number,
      longitude: Number,
    }
  },
  {
    timestamps: true,
  },
);

// Compound index to ensure one attendance record per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
