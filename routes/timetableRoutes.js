import express from "express";
import {
  getTimetableByUser,
  addTimetableEntry,
  updateTimetableEntry,
  bulkUpdateTimetableEntries,
  deleteTimetableEntry,
  clearMonthTimetable,
  getAllTimetables,
} from "../controllers/timetableController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Timetable
 *     description: Endpoints for the Timetable (Shift Scheduling) CRUDs
 */  

// Route to add a timetable entry (Admin Only)
/**
 * @swagger
 * /api/v0/timetable:
 *   post:
 *     summary: Add a timetable entry (Admin only)
 *     tags: 
 *       - Timetable
 *     description: It allows an admin to create a new timetable entry for a user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, date, type]
 *             properties:
 *               userId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               type:
 *                 type: string
 *                 enum:
 *                   - Morning Shift
 *                   - Evening Shift
 *                   - Full-time Shift
 *                   - Day Off
 *                   - Special Shift
 *               location:
 *                 type: string
 *                 enum: [Remote, Onsite]
 *               color:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 example: "08:00"
 *               endTime:
 *                 type: string
 *                 example: "16:00"
 *     responses:
 *       201:
 *         description: Timetable entry created successfully
 *       400:
 *         description: Missing/Invalid fields | Duplicate timetable entry for the same date
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized (Admin only)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.post(
  "/timetable",
  authenticate,
  authorize(["Admin"]),
  addTimetableEntry
);

// Route to update a timetable entry (Admin Only)
/**
 * @swagger
 * /api/v0/timetable:
 *   put:
 *     summary: Update a timetable entry (Admin only)
 *     tags: 
 *        - Timetable
 *     description: It allows an admin to update an existing timetable entry for a user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, date, type, location]
 *             properties:
 *               userId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               type:
 *                 type: string
 *                 enum:
 *                   - Morning Shift
 *                   - Evening Shift
 *                   - Full-time Shift
 *                   - Day Off
 *                   - Special Shift
 *               location:
 *                 type: string
 *                 enum: [Remote, Onsite]
 *               color:
 *                 type: string
 *               duration:
 *                 type: string
 *     responses:
 *       200:
 *         description: Timetable entry updated successfully
 *       400: 
 *         description: Missing/Invalid fields
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User not found | Timetable Entry not found
 *       500:
 *         description: Server Error
 */
router.put(
  "/timetable",
  authenticate,
  authorize(["Admin"]),
  updateTimetableEntry
);

// Route to get all user's timetables (Admin and Supervisor only)
router.get(
  "/timetable",
  authenticate,
  authorize(["Admin", "Supervisor"]),
  getAllTimetables
);

// Route to get a user's timetable: All users can see their own timetable, Admin can see all timetables, Supervisor can see the timetable of the users they supervise
/**
 * @swagger
 * /api/v0/timetable/{userId}:
 *   get:
 *     summary: Get a timetable for a specific user
 *     tags: 
 *        - Timetable
 *     description: It allows to retrieve the timetable for a specific user. Admins can access any user's timetable, Supervisors can access the timetable of the users they supervise, while regular users can only access their own.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *     responses:
 *       200:
 *         description: Timetable fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 result:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Timetable'
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
  "/timetable/:userId",
  authenticate,
  authorize(["Admin", "Supervisor"], { allowSelf: true }),
  getTimetableByUser
);

// Route to bulk update timetable entries
/**
 * @swagger
 * /api/v0/timetable/bulk:
 *   put:
 *     summary: Bulk update or create timetable entries (Admin only)
 *     tags: 
 *        - Timetable
 *     description: It allows an admin to bulk update or create multiple timetable entries at the same time for a user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, dates, type, location]
 *             properties:
 *               userId:
 *                 type: string
 *               dates:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: date-time
 *               type:
 *                 type: string
 *               location:
 *                 type: string
 *               color:
 *                 type: string
 *               duration:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bulk updated successfully
 *       400:
 *         description: Missing/Invalid fields
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.put(
  "/timetable/bulk",
  authenticate,
  authorize(["Admin"]),
  bulkUpdateTimetableEntries
);

// Route to delete a timetable entry (Admin Only)
/**
 * @swagger
 * /timetable:
 *   delete:
 *     summary: Delete a timetable entry (Admin only)
 *     tags: 
 *        - Timetable
 *     description: It allows an admin to delete a specific timetable entry for a user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, date]
 *             properties:
 *               userId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Timetable entry deleted successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User not found | Timetable Entry not found
 *       500:
 *         description: Server Error
 */
router.delete(
  "/timetable",
  authenticate,
  authorize(["Admin"]),
  deleteTimetableEntry
);

// Route to clear all timetable entries for a specific month and year (Admin Only)
/**
 * @swagger
 * /timetable/{userId}/{year}/{month}:
 *   delete:
 *     summary: Clear all timetable entries for a specific month (Admin only)
 *     tags: 
 *        - Timetable
 *     description: It allows an admin to permanently delete all shift records for a user within a target month.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: year
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: month
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Month cleared successfully
 *       400:
 *         description: Missing/Invalid fields
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.delete(
  "/timetable/:userId/:year/:month",
  authenticate,
  authorize(["Admin"]),
  clearMonthTimetable
);

export default router;
