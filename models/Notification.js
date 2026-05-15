import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      // Reference to the User who receives the notification
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Indexing for faster queries by recipient
    },
    type: {
      // Type of notification
      type: String,
      enum: [
        "ACCOUNT",
        "USER_ROLE",
        "DEPARTMENT",
        "DOCUMENT_TYPE",
        "PERSONAL_DOCUMENT",
        "ADMINISTRATIVE_DOCUMENT",
        "ATTENDANCE",
        "TIMETABLE",
      ],
      required: true,
    },
    title: {
      // Notification title
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      // Notification message content
      type: String,
      required: true,
      maxlength: 1000,
    },
    data: {
      // Additional data To make the notification clickable and redirect to the specific document targeted
      type: mongoose.Schema.Types.Mixed,
      default: {
        entityType: null,
        entityId: null,
      },
    },
    isRead: {
      // Whether the notification has been read by the recipient
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Notification", notificationSchema);
