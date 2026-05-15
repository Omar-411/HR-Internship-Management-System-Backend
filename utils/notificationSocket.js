import Notification from "../models/Notification.js";
import { getIO } from "../socket.js";

// Helper function to Count unread notifications and Send the new count to the correct user room
export const emitUnreadNotificationCount = async (recipientId) => {
  const unreadCount = await Notification.countDocuments({
    recipientId,
    isRead: false,
  });

  const io = getIO();
  if (!io) {
    return;
  }
  
  io.to(recipientId.toString()).emit("notification:count", {
    unreadCount,
  });
};
