// Imports
import express from "express";
import { createServer } from "http";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";
import dotenv from "dotenv";
import connectMongo from "./config/db.js";
import { initIO } from "./socket.js";
import "./cron/attendanceCron.js"; // To calculate the attendance stats automatically
import "./cron/resignationCron.js"; // To automatically update resignation statuses and deactivate users
import "./cron/payrollCron.js"; // To automatically generate payrolls every month

// Creation of an express app
const app = express();

import cors from "cors";
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }));

// Create HTTP server and attach Socket.io (mangage websocket connections)
const httpServer = createServer(app);

// Activate Socket.io with CORS Settings
export const io = initIO(httpServer);

// Make io accessible from controllers via req.app.get('io')
app.set("io", io);

import errorHandler from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import UserRoleRoutes from "./routes/userRoleRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import auditLogRoutes from "./routes/auditLogRoutes.js";
import timetableRoutes from "./routes/timetableRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import documentTypeRoutes from "./routes/documentTypeRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import specialShiftRoutes from "./routes/specialShiftRoutes.js";
import leaveTypeRoutes from "./routes/leaveTypeRoutes.js";
import leaveRequestRoutes from "./routes/leaveRequestRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import teamMemberRoutes from "./routes/teamMemberRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import sprintRoutes from "./routes/sprintRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import documentRequestRoutes from "./routes/documentRequestRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import resignationRoutes from "./routes/resignationRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import payrollConfigRoutes from "./routes/payrollConfigRoutes.js";
import allowanceTypeRoutes from "./routes/allowanceTypeRoutes.js";
import bonusTypeRoutes from "./routes/bonusTypeRoutes.js";
import employeeAllowanceRoutes from "./routes/employeeAllowanceRoutes.js";
import employeeBonusRoutes from "./routes/employeeBonusRoutes.js";
import alertRoutes from "./routes/alertRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Handle joining and leaving rooms
  socket.on("joinRoom", (room) => {
    socket.join(room);
    console.log(`[Socket] ${socket.id} joined room: ${room}`);
  });

  socket.on("leaveRoom", (room) => {
    socket.leave(room);
    console.log(`[Socket] ${socket.id} left room: ${room}`);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Load the right .env file based on NODE_ENV
if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: ".env.test" });
} else {
  dotenv.config();
}

if (!process.env.FACE_ATTESTATION_SECRET) {
  console.warn("[SECURITY-WARN] FACE_ATTESTATION_SECRET is not set. Biometric attendance check-in will be rejected.");
}

app.use(express.json({ limit: "10mb" })); // Handle JSON payloads (max size 10mb)
app.use(express.urlencoded({ limit: "10mb", extended: true })); // Parses data sent from HTML forms

// Swagger API Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Connect to MongoDB only if not in test environment (tests will manage their own DB)
if (process.env.NODE_ENV !== "test") {
  connectMongo();
}

// Activate routes
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', leaveRequestRoutes);
app.use('/api', UserRoleRoutes);
app.use('/api', departmentRoutes);
app.use('/api', auditLogRoutes);
app.use('/api', timetableRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', documentTypeRoutes);
app.use('/api', documentRoutes);
app.use('/api', specialShiftRoutes);
app.use('/api', leaveTypeRoutes);
app.use('/api', projectRoutes);
app.use('/api', teamMemberRoutes);
app.use('/api', taskRoutes);
app.use('/api', sprintRoutes);
app.use('/api', teamRoutes);
app.use('/api', meetingRoutes);
app.use('/api', documentRequestRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', resignationRoutes);
app.use('/api', payrollRoutes);
app.use('/api', payrollConfigRoutes);
app.use('/api', allowanceTypeRoutes);
app.use('/api', bonusTypeRoutes);
app.use('/api', employeeAllowanceRoutes);
app.use('/api', employeeBonusRoutes);
app.use('/api', alertRoutes);
app.use('/api', notificationRoutes);

// GLOBAL ERROR HANDLER
app.use(errorHandler);

// Define our PORT
const PORT = process.env.PORT || 3000;

// Export the app for the tests
export default app;

// Start the server only if not in test environment
if (process.env.NODE_ENV !== "test") {
  httpServer.listen(PORT, () => {
    console.log("==================================================");
    console.log(`=== SERVER STARTED AT: ${new Date().toISOString()} ===`);
    console.log(`=== LISTENING ON PORT: ${PORT}                ===`);
    console.log("==================================================");
  });
}
