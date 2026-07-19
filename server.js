// Main server setup for HRcoM API
import express from "express";
import { createServer } from "http";
 // Socket.io is now handled in a separate file
 import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";
import dotenv from "dotenv";
import connectMongo from "./config/db.js";
import "./cron/attendanceCron.js"; // To calculate the attendance stats automatically
 import { initIO } from "./socket.js";
import "./cron/resignationCron.js"; // To automatically update resignation statuses and deactivate users


 

import errorHandler from "./middleware/errorHandler.js";
import authenticate from "./middleware/authenticate.js";
import authorize from "./middleware/authorize.js";
import swaggerAuth from "./middleware/swaggerAuth.js";

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
import cors from "cors";
import "./socketServer.js";

// Create Express app and HTTP server
const app = express();
const httpServer = createServer(app);

// Activate Socket.io with CORS Settings
export const io = initIO(httpServer);

// Make io accessible from controllers via req.app.get('io')
app.set("io", io);

// Import and start Socket.io server (separate process)
 
// Load the right .env file based on NODE_ENV
if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: ".env.test" });
} else {
  dotenv.config();
}

if (!process.env.FACE_ATTESTATION_SECRET) {
  console.warn(
    "[SECURITY-WARN] FACE_ATTESTATION_SECRET is not set. Biometric attendance check-in will be rejected."
  );
}

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// CORS configuration for browser clients
const allowedOrigins = [
  "http://localhost:5173",
  "https://hr-internship-management-system.vercel.app",
  "https://hr.dotjcom.tech",
];

app.use(
  cors({
    origin: allowedOrigins,
  }),
);

// Handle CORS preflight (OPTIONS) requests for all routes
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Swagger API Documentation (env-controlled, basic auth in production)
const enableSwagger =
  process.env.ENABLE_SWAGGER === "true" || process.env.NODE_ENV !== "production";

if (enableSwagger) {
  if (process.env.NODE_ENV === "production") {
    // In production, protect Swagger UI with simple Basic Auth
    app.use(
      "/api-docs",
      swaggerAuth,
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec)
    );
  } else {
    // In non-production environments, expose Swagger UI without auth
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }
}

// Connect to MongoDB
connectMongo();

 // Activate routes
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', UserRoleRoutes);
app.use('/api', departmentRoutes);
app.use('/api', auditLogRoutes);
app.use('/api', timetableRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', documentTypeRoutes);
app.use('/api', documentRoutes);
app.use('/api', specialShiftRoutes);
app.use('/api', leaveTypeRoutes);
app.use('/api', leaveRequestRoutes);
app.use('/api', projectRoutes);
app.use('/api', teamMemberRoutes);
app.use('/api', taskRoutes);
app.use('/api', sprintRoutes);
app.use('/api', teamRoutes);
app.use('/api', meetingRoutes);
app.use('/api', documentRequestRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', resignationRoutes);
 
 

// Global error handler
app.use(errorHandler);

// Define PORT
const PORT = process.env.PORT || 3000;

// Export the app for tests
export default app;

// Start the HTTP server (not in test environment)
if (process.env.NODE_ENV !== "test") {
  httpServer.listen(PORT, () => {
    console.log("==================================================");
    console.log(`=== SERVER STARTED AT: ${new Date().toISOString()} ===`);
    console.log(`=== LISTENING ON PORT: ${PORT}                ===`);
    console.log("==================================================");
  });
}
