import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema(
  {
    employeeId: {
      // Represents the employee who is requesting the leave
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    supervisorId: {
      // Represents the supervisor who will approve/reject the leave request (for employees/Interns)
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      default: null,
    },
    reviewedBy: {
      // Represents the admin who will review the leave request
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    typeId: {
      // Represents the type of leave being requested
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveType",
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
    reason: {
      // Represents the employee's reason for the leave request
      type: String,
    },
    status: {
      type: String,
      enum: [
        "Pending Supervisor Approval",
        "Under Supervisor Review",
        "Rejected by Supervisor",
        "Pending Admin Approval",
        "Under Admin Review",
        "Rejected by Admin",
        "Approved",
      ],
      default: "Pending Supervisor Approval",
    },
    comments: {
      // Represents any comments from the approver regarding the leave request
      type: String,
    },
    attachmentURL: {
      type: String,
      default: "",
    },
    attachmentPublicId: {
      // To store the Cloudinary public ID for deletion
      type: String,
      default: "",
    }, 
    duration: {
      // Represents the total number of days for the leave request (automatically calculated)
      type: Number,
    },
  },
  {
    timestamps: true,
  },
);

// Create a compound index to optimize queries filtering by status and reviewedBy
leaveRequestSchema.index({ status: 1, reviewedBy: 1 });

export default mongoose.model("LeaveRequest", leaveRequestSchema);
