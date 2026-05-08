import mongoose from "mongoose";

const resignationSchema = new mongoose.Schema(
  {
    employeeId: {
      // Reference to the User who is resigning
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    employeeSnapshot: {
      // A snapshot of the employee's details at the time of resignation submission
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      department: {
        // The department name
        type: String,
        required: true,
      },
      position: {
        type: String,
        required: true,
      },
    },
    submissionDate: {
      // The date when the resignation was submitted
      type: Date,
      default: Date.now,
    },
    noticePeriod: {
      // 2 weeks notice period
      type: Number,
      required: true,
      default: 14,
    },
    lastWorkingDate: {
      // The date when the employee's last working day is: submissionDate + noticePeriod
      type: Date,
    },
    reason: {
      // The reason for resignation provided by the employee
      type: String,
      required: true,
    },
    clarificationMessage: {
      // If the admin requests clarification, this field will contain the message from the admin
      type: String,
      default: null,
    },
    clarificationResponse: {
      // If the employee responds to the clarification request, this field will contain the response from the employee
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: [
        "submitted",
        "clarification_requested",
        "approved",
        "scheduled_exit", // The employee has reached their last working day
        "inactive", // The employee is fully gone from the system
      ],
      default: "submitted",
    },
    approval: {
      // In case of approval, we need to track who approved the resignation and when
      processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      processedAt: {
        type: Date,
        default: null,
      },
    },
    clarification: {
      // In case of clarification request, we need to track who requested the clarification and when
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      requestedAt: {
        type: Date,
        default: null,
      },
    },
    payrollImpact: {
      // If the resignation has an impact on payroll (e.g. employee is leaving in the middle of the month), we can track the affected period for payroll calculations
      from: {
        type: Date,
      },
      to: {
        type: Date,
      },
    },
    finalSettlement: {
      finalSalary: {
        // Final salary after prorated payroll computation
        type: Number,
        default: 0,
      },
      remainingLeaveBalance: {
        // Remaining leave days at the time of resignation
        type: Number,
        default: 0,
      },
      pendingTasks: {
        // Number of pending tasks at the time of resignation
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true },
);

export default mongoose.model("Resignation", resignationSchema);
