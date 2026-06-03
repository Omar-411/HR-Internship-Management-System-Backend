import mongoose from "mongoose";

const meetingSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      // The meeting overview
      type: String,
    },
    projectId: {
      // The linked project of the meeting
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    sprintId: {
      // The linked sprint of the meeting (optional, in case of the sprint review meeting for ex)
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      default: null,
    },
    date: {
      // The date of the meeting
      type: Date,
      required: true,
    },
    startTime: {
      type: String, // "HH:mm"
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    locationType: {
      type: String,
      enum: ["Online", "Physical"],
      required: true,
    },
    meetingLink: {
      // The meeting link (for example: Zoom, Google Meet, etc.)
      type: String,
      default: null,
    },
    address: {
      // The physical address of the meeting (for example: "Lac 1, Tunis")
      type: String,
      default: null,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    reminderMinutesBefore: {
      // The reminder time before the meeting in minutes (for example: 5, 10, 15, 30, 60)
      type: Number,
      enum: [5, 10, 15, 30, 60],
      default: 15,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    attendees: [
      // The meeting attendees
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["Pending", "Accepted", "Rejected"],
          default: "Pending",
        },
        responseReason: {
          type: String,
          default: null,
        },
        respondedAt: {
          type: Date,
        },
      },
    ],
    status: {
      // The meeting status
      type: String,
      enum: ["Scheduled", "Completed", "Cancelled"],
      default: "Scheduled",
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Meeting", meetingSchema);
