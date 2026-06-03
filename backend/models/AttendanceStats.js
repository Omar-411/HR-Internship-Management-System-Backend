import mongoose from "mongoose";

const attendanceStatsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    periodType: {
      type: String,
      enum: ["day", "month", "trimester", "year", "custom"],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    present: {
      type: Number,
      default: 0,
    },
    late: {
      type: Number,
      default: 0,
    },
    absent: {
      type: Number,
      default: 0,
    },
    avgCheckInMinutes: {
      type: Number,
      default: null,
    },
    totalAttendance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("AttendanceStats", attendanceStatsSchema);
