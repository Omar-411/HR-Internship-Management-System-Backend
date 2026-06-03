import { Server } from "socket.io";

let io;

export const initIO = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
    },
  });
  return io;
};

export const getIO = () => {
  if (!io) {
    // In some cases, we might want to return a mock or just log a warning
    // instead of throwing, to avoid crashing the server.
    console.warn("[Socket] getIO called before initialization");
  }
  return io;
};
