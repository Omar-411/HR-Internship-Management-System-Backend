import mongoose from "mongoose";

const timetableSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "Morning Shift",
        "Evening Shift",
        "Full-time Shift",
        "Day Off",
        "Special Shift",
      ],
      required: true,
    },
    isPublicHoliday: {
      // Flag to indicate if the day is a public holiday (affects payroll calculations)
      type: Boolean,
      default: false,
    },
    startTime: {
      type: String,
      required: function () {
        const type =
          this.type ||
          this.getUpdate?.()?.type ||
          this.getUpdate?.()?.$set?.type;

        return type !== "Day Off";
      },
      validate: {
        validator: function (v) {
          return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
        },
        message: "The Start Time must be in HH:mm format",
      },
    },
    endTime: {
      type: String,
      required: function () {
        const type =
          this.type ||
          this.getUpdate?.()?.type ||
          this.getUpdate?.()?.$set?.type;

        return type !== "Day Off";
      },
      validate: {
        validator: function (v) {
          return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
        },
        message: "The End Time must be in HH:mm format",
      },
    },
    gracePeriod: {
      // Period in minutes for late arrivals
      type: Number,
      default: 5,
    },
    location: {
      type: String,
      enum: ["Remote", "Onsite"],
      required: function () {
        const type =
          this.type ||
          this.getUpdate?.()?.type ||
          this.getUpdate?.()?.$set?.type;

        return type !== "Day Off";
      },
    },
    color: {
      type: String,
    },
    specialShiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SpecialShift",
      default: null,
    },
    // Inline custom shift data (custom one-time, not saved to SpecialShift collection)
    specialShiftData: {
      type: new mongoose.Schema(
        {
          shiftType: { type: String, enum: ["single", "double"] },
          periods: [
            {
              startTime: { type: String },
              endTime: { type: String },
              _id: false,
            },
          ],
        },
        { _id: false },
      ),
      default: null,
    },
    specialShiftName: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index to ensure a single shift per day per user
timetableSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("Timetable", timetableSchema);
