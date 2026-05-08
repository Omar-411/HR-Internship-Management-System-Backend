import mongoose from "mongoose";

const taskSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Backlog", "To Do", "In Progress", "Review", "Done"],
      default: "Backlog",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    storyPoints: {
      type: Number,
      enum: [1, 2, 3, 5, 8, 13],
      default: 3,
    },
    type: {
      type: String,
      enum: ["Story", "Task", "Sub-task", "Bug"],
      default: "Task",
    },
    parentTaskId: {
      // For sub-tasks, this references the parent task
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    sprintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      default: null, // In this case, the task is in the backlog and not yet assigned to a sprint
    },
    completedAt: {
      // Date when the task was marked as "Done"
      type: Date,
    },
    submission: {
      summary: {
        type: String,
      },
      type: {
        type: String,
        enum: ["none", "file", "link"],
        default: "none",
      },
      linkUrl: {
        // Cloudinary URL or Link for the submitted task
        type: String,
        default: "",
      },
      linkPublicId: {
        // Cloudinary public ID for easy deletion if needed
        type: String,
        default: null,
      },
      submittedAt: {
        type: Date,
      },
      comment :{
        type: String,
      },
      hoursSpent: {
        type: Number,
        min: 0,
      },
      completionRate: {
        type: Number,
        min: 0,
        max: 100,
      },
    },
    comments: [
      {
        text: {
          type: String,
        },
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: {
          type: Date        
        },
      }
    ],
    sprintClosedAtSubmission: {
      // Flag to track if the sprint was already closed at the time of submission
      type: Boolean,
      default: false,
    },
    isSubmittedAfterSprintEnd: {
      // Flag to track late submissions after the sprint due date
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
    },
    dueDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Validator to ensure sub-tasks have a parent and only sub-tasks can have a parent (1 level only).
taskSchema.pre("save", async function () {
  // CASE 1: Sub-task must have a parent
  if (this.type === "Sub-task" && !this.parentTaskId) {
    throw new Error("Sub-tasks must have a Parent Task!");
  }

  // CASE 2: Only Sub-task can have a parent
  if (this.type !== "Sub-task" && this.parentTaskId) {
    throw new Error("Only Sub-tasks can have a Parent Task!");
  }

  // CASE 3: Prevent sub-task of sub-task
  if (this.parentTaskId) {
    const parent = await mongoose.model("Task").findById(this.parentTaskId);

    if (!parent) {
      throw new Error("Parent task not found!");
    }

    if (parent.parentTaskId) {
      throw new Error("Cannot create a sub-task of another sub-task!");
    }
  }
});

export default mongoose.model("Task", taskSchema);
