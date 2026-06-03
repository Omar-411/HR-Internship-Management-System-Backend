import mongoose from "mongoose";

const sprintSchema = mongoose.Schema(
  {
    number: {
      // Sprint number within the project (For example: Sprint 1, Sprint 2, etc.)
      type: Number, 
      required: true,
    },
    name: {
      // The name of the sprint. (For example: "Core User Management", "Authentification", etc.)
      type: String,
      required: true,
    },
    goal: {
      // The goal of the sprint
      type: String,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
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
    completedAt: {
      type: Date,
    },
    durationInWeeks: {
      type: Number,
      enum: [1, 2, 3, 4],
      default: 2,
    },
    status: {
      type: String,
      enum: ["Planned", "Active", "Completed"],
      default: "Planned",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Sprint", sprintSchema);
