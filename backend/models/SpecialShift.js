import mongoose from "mongoose";

// Stores reusable special shift types that admins can define once and apply to multiple timetable slots.
const periodSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: [true, "Start time is required"],
      match: [/^\d{2}:\d{2}$/, "Time must be in HH:MM format"],
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
      match: [/^\d{2}:\d{2}$/, "Time must be in HH:MM format"],
    },
  },
  { _id: false }
);

const specialShiftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Shift name is required"],
      trim: true,
      maxlength: [80, "Name must be 80 characters or less"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, "Description must be 300 characters or less"],
    },
    type: {
      type: String,
      enum: {
        values: ["single", "double"],
        message: "Type must be 'single' or 'double'",
      },
      required: [true, "Shift structure type is required"],
    },
    periods: {
      type: [periodSchema],
      validate: [
        {
          // Enforce periods array length matches type
          validator: function (periods) {
            if (this.type === "single") return periods.length === 1;
            if (this.type === "double") return periods.length === 2;
            return false;
          },
          message:
            "A 'single' shift must have exactly 1 period; a 'double' shift must have exactly 2 periods",
        },
      ],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("SpecialShift", specialShiftSchema);
