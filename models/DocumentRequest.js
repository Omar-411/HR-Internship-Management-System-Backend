import mongoose from "mongoose";

const documentRequestSchema = new mongoose.Schema(
  {
    title: {
      // Document request title (e.g., "Request for Project Plan Document")
      type: String,
      required: true,
    },
    description: {
      // Document request description
      type: String,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    scope: {
      type: String,
      enum: ["Sprint", "Backlog", "Project"],
      required: true,
    },
    sprintId: {
      // If scope is "Sprint", this field references the specific sprint
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      default: null,
    },
    taskId: {
      // If scope is "Backlog", this field references the specific task
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    dueDate: {
      // Optional due date for fulfilling the document request
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["Pending", "Under Review", "Fulfilled"],
      default: "Pending",
    },
    fileURL: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    public_id: {
      type: String,
      default: null,
    },
    rejectionComment: {
      type: String,
      default: null,
    },
    fulfilledAt: {
      type: Date,
      default: null,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("DocumentRequest", documentRequestSchema);
