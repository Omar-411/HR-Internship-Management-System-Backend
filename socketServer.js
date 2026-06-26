// socketServer.js
import { Server } from "socket.io";
import { createServer } from "http";

const SOCKET_PORT = process.env.SOCKET_PORT || 4000;

// Create a basic HTTP server for Socket.io
const socketServer = createServer();

export const io = new Server(socketServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://hr-internship-management-system.vercel.app"
    ],
    methods: ["GET", "POST"],
  },
});

if (process.env.NODE_ENV !== "test") {
  socketServer.listen(SOCKET_PORT, () => {
    console.log(`Socket.io server listening on port ${SOCKET_PORT}`);
  });
}

// Log all incoming connections and errors for debugging
io.on("connection", (socket) => {
  console.log(`[Socket.io] Connection from ${socket.handshake.address} (id: ${socket.id})`);

  socket.on("error", (err) => {
    console.error(`[Socket.io] Error on socket ${socket.id}:`, err);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[Socket.io] Disconnected: ${socket.id}, reason: ${reason}`);
  });

  // Log all events received for debugging
  socket.onAny((event, ...args) => {
    console.log(`[Socket.io] Event received: ${event}`, args);
  });
});
