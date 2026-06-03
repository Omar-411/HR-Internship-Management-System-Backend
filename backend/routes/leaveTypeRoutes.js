import express from "express";
import {
  addLeaveType,
  updateLeaveType,
  archiveLeaveType,
  restoreLeaveType,
  getAllLeaveTypes,
} from "../controllers/leaveTypeController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const route = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Leave Types
 *     description: Endpoints for the leave types CRUDs
 */

// Route to add a new Leave Type (Admin only)
/**
 * @swagger
 * /api/leaveType:
 *   post:
 *     tags:
 *       - Leave Types
 *     summary: Add a new leave type (Admin only)
 *     description: It allows an admin to create a new leave type.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Vacation
 *               description:
 *                 type: string
 *                 example: Paid annual leave
 *               isPaid:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Leave type created successfully
 *       400:
 *         description: "Invalid Input .E.g: Missing required fields"
 *       401:
 *         description: Invalid/Missing token
 *       403:
 *         description: Unauthorized 
 *       404:
 *         description: Leave type Not found
 *       409:
 *         description: Leave type already exists
 *       500:
 *         description: Server error
 */
route.post( 
  "/leaveType", 
  authenticate, 
  authorize(["Admin"]), 
  addLeaveType
);

// Route to update a Leave Type (Admin only)
/**
 * @swagger
 * /api/leaveType/{id}:
 *   patch:
 *     tags:
 *       - Leave Types
 *     summary: Update an existing leave type (Admin only)
 *     description: "It allows an admin to update the details of an existing leave type. NOTE: You cannot update an archived leave type, you need to restore it first."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Leave Type ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Annual Leave
 *               description:
 *                 type: string
 *                 example: Updated description
 *               isPaid:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Leave type updated successfully
 *       400:
 *         description: Invalid input | Trying to update an archived leave type
 *       401:
 *         description: Invalid/Missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Leave type not found
 *       409:
 *         description: Leave type name already exists
 *       500:
 *         description: Server error
 */
route.patch(
  "/leaveType/:id",
  authenticate,
  authorize(["Admin"]),
  updateLeaveType,
);

// Route to archive a Leave Type (Admin only)
/**
 * @swagger
 * /api/leaveType/archive/{id}:
 *   patch:
 *     tags:
 *       - Leave Types
 *     summary: Archive a leave type (Admin only)
 *     description: It allows an admin to archive a leave type.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Leave Type ID
 *     responses:
 *       200:
 *         description: Leave type archived successfully
 *       400:
 *         description: Leave type already archived
 *       401:
 *         description: Invalid/Missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Leave type not found
 *       500:
 *         description: Server error
 */
route.patch(
  "/leaveType/archive/:id",
  authenticate,
  authorize(["Admin"]),
  archiveLeaveType
);

// Route to restore an archived Leave Type (Admin only)
/**
 * @swagger
 * /api/leaveType/restore/{id}:
 *   patch:
 *     tags:
 *       - Leave Types
 *     summary: Restore an archived leave type (Admin only)
 *     description: It allows an admin to restore an archived leave type.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Leave Type ID
 *     responses:
 *       200:
 *         description: Leave type restored successfully
 *       400:
 *         description: Leave type already active
 *       401:
 *         description: Invalid/Missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Leave type not found
 *       500:
 *         description: Server error
 */
route.patch(
  "/leaveType/restore/:id",
  authenticate,
  authorize(["Admin"]),
  restoreLeaveType
);

// Route to get all active Leave Types (All authenticated users for the leave requests form)
/**
 * @swagger
 * /api/leaveTypes:
 *   get:
 *     tags:
 *       - Leave Types
 *     summary: Get all leave types (All authenticated users for the leave requests form)
 *     description: It allows any authenticated user to get the list of all leave types. This is used in the leave request form to select the type of leave they want to request.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of leave types retrieved successfully
 *       401:
 *         description: Missing/Invalid token
 *       500:
 *         description: Server error
 */
route.get(
  "/leaveTypes", 
  authenticate, 
  getAllLeaveTypes
);

export default route;
