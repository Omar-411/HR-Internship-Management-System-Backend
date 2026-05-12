import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    senderId: {
      // User who submitted the alert
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    alertType: {
      // Category of the alert
      type: String,
      enum: ["TECHNICAL", "BEHAVIORAL"],
      required: true,
    },
    recipientType: {
      // Send to whom? Supervisor or HR Department
      type: String,
      enum: ["SUPERVISOR", "HR_DEPARTMENT"],
      required: true,
    },
    alertDate: {
      // Date when the alert was submitted
      type: Date,
      default: Date.now,
    },
    recipientId: {
      // The person that will receive the alert
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    subject: {
      // Short description/title
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      // Detailed description
      type: String,
      required: true,
      trim: true,
      maxlength: 600,
    },
    isAnonymous: {
      // Represents whether the alert was submitted anonymously (true) or not (false)
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["NEW", "UNDER_REVIEW", "RESOLVED", "DISMISSED"],
      default: "NEW",
    },
    resolutionNote: {
      // Final note when resolving or dismissing the alert
      type: String,
      default: null,
    },
    handledBy: {
      // Admin or supervisor currently handling the alert
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      // Date when the alert was marked as RESOLVED or DISMISSED
      type: Date,
      default: null,
    },
    attachmentURL: {
      // Optional attachment (screenshot, document, etc.)
      type: String,
      default: null,
    },
    attachmentPublicId: {
      // Public ID for the deletion from Cloudinary if needed
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient querying
alertSchema.index({ senderId: 1, createdAt: -1 });
alertSchema.index({ recipientId: 1, status: 1 });

export default mongoose.model("Alert", alertSchema);
