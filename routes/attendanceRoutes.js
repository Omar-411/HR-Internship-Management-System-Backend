import express from "express";
import {
  checkIn,
  createFaceChallenge,
  checkOut,
  getAttendance,
  getMyStatus,
  updateAttendance,
  exportUserAttendance,
  exportDepartmentAttendance,
  exportAttendanceStatistics,
  getAllStatuses,
} from "../controllers/attendanceController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Attendance
 *     description: Endpoints for the Attendance CRUDs
 */

// ------------------------------------------------------------------------ //
// ------------------ Routes for all authenticated users ------------------ //
// ------------------------------------------------------------------------ //

// Check-in
router.post("/attendance/face-challenge", authenticate, createFaceChallenge);

/**
 * @swagger
 * /api/v0/attendance/check-in:
 *   post:
 *     summary: Check in for today (All authenticated users)
 *     tags: 
 *       - Attendance
 *     description: Check in for today. The system will automatically determine the attendance status (present, late, absent). The user must provide their location (Remote or Onsite) during the check-in.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [location]
 *             properties:
 *               location:
 *                 type: string
 *                 enum: [Remote, Onsite]
 *                 example: Remote
 *     responses:
 *       200:
 *         description: User Checked in successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 *       401:
 *         description: Missing/Invalid token
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.post("/attendance/check-in", authenticate, checkIn);

// Check-out
/**
 * @swagger
 * /api/v0/attendance/check-out:
 *   post:
 *     summary: Check out for today (All authenticated users)
 *     tags: 
 *       - Attendance
 *     description: Check out for today. The system will update the attendance record with the check-out time.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User Checked out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 *       401:
 *         description: Missing/Invalid token
 *       404:
 *         description: No attendance record found for today | User not found
 *       500:
 *         description: Server Error
 */
router.post("/attendance/check-out", authenticate, checkOut);

// Get the user's attendance status for today
/**
 * @swagger
 * /api/v0/attendance/me:
 *   get:
 *     summary: Get the current user's attendance status for today
 *     tags: 
 *       - Attendance
 *     description: Get the current user's attendance status for today, including check-in time, check-out time, attendance status (present, late, absent), and location (Remote or Onsite).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's attendance record for today (can be null if the user hasn't checked in yet)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 *       401:
 *         description: Missing/Invalid token
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.get("/attendance/me", authenticate, getMyStatus);

// ------------------------------------------------------------------------ //
// ------------------ Routes for Admins and Supervisors ------------------- //
// ------------------------------------------------------------------------ // 

// Get attendance records (Admin/Supervisor)
/**
 * @swagger
 * /api/v0/attendance:
 *   get:
 *     summary: Get attendance records (Admin/Supervisor)
 *     tags: 
 *       - Attendance
 *     description: Get attendance records with optional filters by user ID and date range. Admins can view all records, while Supervisors can only view records of their supervisees.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID (optional)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter (optional)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter (optional)
 *     responses:
 *       200:
 *         description: List of attendance records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                   example: 5
 *                 result:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Attendance'
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.get(
  "/attendance",
  authenticate,
  authorize(["Admin", "Supervisor", "Employee", "Intern"]),
  getAttendance
);

// Get statuses of Attendance (Admin/Supervisor)
/**
 * @swagger
 * /api/v0/attendance/statuses:
 *   get:
 *     summary: Get the list of attendance statuses
 *     tags: 
 *       - Attendance
 *     description: Get the list of distinct attendance statuses (present, late, absent, leave, day-off).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of attendance statuses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       500:
 *         description: Server Error
 */
router.get(
  "/attendance/statuses",
  authenticate,
  authorize(["Admin", "Supervisor"]),
  getAllStatuses
);

// Update attendance record (Admin only)
/**
 * @swagger
 * /api/v0/attendance/{id}:
 *   patch:
 *     summary: update an attendance record (Admin only)
 *     tags: 
 *       - Attendance
 *     description: Allowd an Admin to update an attendance record.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Attendance record ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkInTime:
 *                 type: string
 *                 example: "09:17 AM"
 *               checkOutTime:
 *                 type: string
 *                 example: "05:00 PM"
 *               status:
 *                 type: string
 *                 enum: [present, late, absent, leave]
 *                 example: present
 *               location:
 *                 type: string
 *                 enum: [Remote, Onsite]
 *                 example: Remote
 *               notes:
 *                 type: string
 *                 example: "Worked from home"
 *     responses:
 *       200:
 *         description: Attendance updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized 
 *       404:
 *         description: Attendance record not found
 *       500:
 *         description: Server Error
 */
router.patch(
  "/attendance/:id",
  authenticate,
  authorize(["Admin"]),
  updateAttendance
);

// Export Attendance records (CSV/Excel) for a specific user and period (Admin Only)
/**
 * @swagger
 * /export:
 *   get:
 *     summary: Export attendance records for a user
 *     tags:
 *       - Attendance
 *     description: >
 *       Allows an admin to export attendance records of a specific user.
 *       The export can be filtered by month, trimester, year, or a custom date range.
 *       The admin can choose the output format (CSV or Excel).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the user
 *         example: "69b87703ee749bf5df5e3246"
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [month, trimester, year, custom]
 *         description: Type of period filter
 *         example: month
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Year for filtering (required for month, trimester, year)
 *         example: 2026
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *         description: Month number (1-12). Required if type is "month"
 *         example: 3
 *       - in: query
 *         name: trimester
 *         schema:
 *           type: integer
 *         description: Trimester number (1-4). Required if type is "trimester"
 *         example: 1
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date of custom range (required if type is "custom")
 *         example: "2026-03-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date of custom range (required if type is "custom")
 *         example: "2026-03-31"
 *       - in: query
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *           enum: [csv, excel]
 *         description: Output file format
 *         example: csv
 *     responses:
 *       200:
 *         description: Attendance records of the user exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Attendance records exported successfully
 *                 fileUrl:
 *                   type: string
 *                   description: URL or path to download the exported file
 *                   example: "/downloads/attendance_JohnDoe_March2026.csv"
 *       400:
 *         description: Invalid request parameters or missing required fields
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized (Admin only)
 *       404:
 *         description: No attendance records found for the specified period | User not found
 *       500:
 *         description: Server Error
 */
router.get(
  "/export", 
  authenticate, 
  authorize("Admin"), 
  exportUserAttendance
);

// Export Attendance records (CSV/Excel) for a specific department and period (Admin Only)
/**
 * @swagger
 * /export/department:
 *   get:
 *     summary: Export attendance records for a department (Admin only)
 *     tags:
 *       - Attendance
 *     description: >
 *       Allows an admin to export attendance records of all users in a specific department.
 *       The export can be filtered by month, trimester, year, or a custom date range.
 *       The output can be in CSV or Excel format.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the department (must be unique)
 *         example: "Human Resources"
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [month, trimester, year, custom]
 *         description: Type of period filter
 *         example: month
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Year for filtering (required for month, trimester, year)
 *         example: 2026
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *         description: Month number (1-12). Required if type is "month"
 *         example: 3
 *       - in: query
 *         name: trimester
 *         schema:
 *           type: integer
 *         description: Trimester number (1-4). Required if type is "trimester"
 *         example: 1
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date of custom range (required if type is "custom")
 *         example: "2026-03-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date of custom range (required if type is "custom")
 *         example: "2026-03-31"
 *       - in: query
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *           enum: [csv, excel]
 *         description: Output file format
 *         example: excel
 *     responses:
 *       200:
 *         description: Attendance records of the department exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Attendance records exported successfully
 *                 fileUrl:
 *                   type: string
 *                   description: URL or path to download the exported file
 *                   example: "/downloads/attendance_humanresources_department_March2026.xlsx"
 *       400:
 *         description: Invalid request parameters or missing required fields
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized (Admin only)
 *       404:
 *         description: Department not found | No users in department | No attendance records
 *       500:
 *         description: Server Error
 */
router.get(
  "/export/department",
  authenticate,
  authorize("Admin"),
  exportDepartmentAttendance
);

// Export attendance stats (Admin only)
/**
 * @swagger
 * /stats/export:
 *   get:
 *     summary: Export attendance statistics (Admin only)
 *     tags:
 *       - Attendance
 *     description: >
 *       Allows an admin to export attendance statistics based on filters such as a specific user,
 *       a department, or globally for all users.
 *       The export supports different period types (month, trimester, year, or custom range)
 *       and allows selecting specific KPIs dynamically.
 *       The output can be in CSV or Excel format.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userName
 *         required: false
 *         schema:
 *           type: string
 *         description: First name of the user
 *         example: "John"
 *       - in: query
 *         name: userLastName
 *         required: false
 *         schema:
 *           type: string
 *         description: Last name of the user
 *         example: "Doe"
 *       - in: query
 *         name: userEmail
 *         required: false
 *         schema:
 *           type: string
 *         description: Email of the user (used with name for precise identification)
 *         example: "john.doe@email.com"
 *       - in: query
 *         name: departmentName
 *         required: false
 *         schema:
 *           type: string
 *         description: Name of the department
 *         example: "Human Resources"
 *       - in: query
 *         name: periodType
 *         required: false
 *         schema:
 *           type: string
 *           enum: [month, trimester, year, custom]
 *         description: Type of period filter
 *         example: month
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (required if periodType is "custom")
 *         example: "2026-03-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (required if periodType is "custom")
 *         example: "2026-03-31"
 *       - in: query
 *         name: kpis
 *         required: false
 *         schema:
 *           type: string
 *         description: >
 *           Comma-separated list of KPIs to include in the export.
 *           If not provided, all KPIs will be included.
 *         example: "presentDays,absentDays,lateDays"
 *       - in: query
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *           enum: [csv, excel]
 *         description: Output file format
 *         example: excel
 *     responses:
 *       200:
 *         description: Attendance statistics exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Attendance statistics exported successfully
 *                 fileUrl:
 *                   type: string
 *                   description: URL or path to download the exported file
 *                   example: "/downloads/attendance_stats_March2026.xlsx"
 *       400:
 *         description: Invalid request parameters or missing required fields
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized (Admin only)
 *       404:
 *         description: User not found | Department not found | No attendance statistics found
 *       500:
 *         description: Server Error
 */
router.get(
  "/stats/export", 
  authenticate, 
  authorize("Admin"), 
  exportAttendanceStatistics
);

export default router;
