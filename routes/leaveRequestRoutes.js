import express from "express";
import {
  getAllLeaveRequests,
  getLeaveRequestById,
  addLeaveRequest,
  updateLeaveRequest,
  cancelLeaveRequest,
  markLeaveRequestUnderReview,
  approveOrRejectLeaveRequest,
  getLeaveStatuses,
} from "../controllers/leaveRequestController.js";
import { upload } from "../middleware/upload.js";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Leave Requests
 *     description: Endpoints for managing leave requests
 */

// ─── Leave Requests — Mutations (Action Specific) ───────────────────────────

// Route to mark a leave request as under review (Supervisor/Admin)
/**
 * @swagger
 * /api/leave-requests/mark-under-review/{id}:
 *   patch:
 *     tags:
 *       - Leave Requests
 *     summary: Mark a leave request as under review (Supervisor/Admin)
 *     description: It allows a supervisor or an admin to mark a leave request as under review when they start reviewing it.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Leave request ID
 *     responses:
 *       200:
 *         description: Leave request marked under review
 *       400:
 *         description: Leave request cannot be marked under review | Leave request unavailable
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Leave request not found
 *       500:
 *         description: Server error
 */
router.patch(
  "/leave-requests/mark-under-review/:id",
  authenticate,
  markLeaveRequestUnderReview,
);

// Route to approve or reject a leave request (Supervisor/Admin)
/**
 * @swagger
 * /api/leave-requests/approve-reject/{id}:
 *   patch:
 *     tags:
 *       - Leave Requests
 *     summary: Approve or reject a leave request (Supervisor/Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Leave request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *               comments:
 *                 type: string
 *     responses:
 *       200:
 *         description: Leave request approved or rejected successfully
 *       400:
 *         description: Action must be 'approve' or 'reject'
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Leave request not found
 *       500:
 *         description: Server error
 */
router.patch(
  "/leave-requests/approve-reject/:id",
  authenticate,
  approveOrRejectLeaveRequest,
);

// ─── Leave Requests — Mutations (General) ──────────────────────────────────

// Route to add a new leave request (Every authenticated user)
/**
 * @swagger
 * /leave-requests:
 *   post:
 *     summary: Submit a new leave request
 *     description: It allows an intern, employee or a supervisor to submit a new leave request.
 *     tags:
 *       - Leave Requests
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               typeId:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               reason:
 *                 type: string
 *               attachement:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Leave request submitted successfully
 *       400:
 *         description: Missing required fields | Invalid date range | Invalid leave type | Overlapping leave requests
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User not found | Supervisor not found
 *       500:
 *         description: Server error
 */
router.post(
  "/leave-requests",
  authenticate,
  upload("doc").single("attachment"),
  addLeaveRequest,
);

// ─── Leave Statuses & Reads ──────────────────────────────────────────────────

// Route to get leave request statuses based on user role (Every authenticated user)
/**
 * @swagger
 * /api/leave-statuses:
 *   get:
 *     tags:
 *       - Leave Requests
 *     summary: Get leave request statuses based on user
 *     description: It allows any authenticated user to get the list of leave request statuses based on their role.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of leave request statuses
 *       401:
 *         description: Unauthorized (Invalid/missing token)
 *       403:
 *         description: Forbidden (Insufficient permissions)
 *       500:
 *         description: Server error
 */
router.get("/leave-statuses", authenticate, getLeaveStatuses);

// Route to get all leave requests with pagination (Every authenticated user)
/**
 * @swagger
 * /api/leave-requests:
 *   get:
 *     tags:
 *       - Leave Requests
 *     summary: Get all leave requests with pagination (based on user role)
 *     description: It allows any authenticated user to get a paginated list of leave requests.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: "Page number (default: 1)"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: "Number of leave requests per page (default: 10)"
 *       - in: query
 *         name: typeId
 *         schema:
 *           type: string
 *         description: Filter by leave type ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by leave request status
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *         description: Filter by month (requires year)
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Filter by year
 *     responses:
 *       200:
 *         description: List of leave requests with pagination and filters
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/leave-requests", authenticate, getAllLeaveRequests);

// Route to get a leave request by ID
/**
 * @swagger
 * /api/leave-requests/{id}:
 *   get:
 *     tags:
 *       - Leave Requests
 *     summary: Get a leave request by ID
 *     description: It allows to get the details of a specific leave request by its ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Leave request ID
 *     responses:
 *       200:
 *         description: Leave request details
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Leave request not found
 *       500:
 *         description: Server error
 */
router.get("/leave-requests/:id", authenticate, getLeaveRequestById);

// Route to update a leave request (The user himself)
/**
 * @swagger
 * /api/leave-requests/{id}:
 *   patch:
 *     tags:
 *       - Leave Requests
 *     summary: Update a leave request (only by the owner while only pending)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Leave request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               typeId:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               reason:
 *                 type: string
 *               attachmentURL:
 *                 type: string
 *     responses:
 *       200:
 *         description: Leave request updated successfully
 *       400:
 *         description: Validation error | leave request cannot be updated
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Leave request not found
 *       500:
 *         description: Server error
 */
router.patch(
  "/leave-requests/:id",
  authenticate,
  upload("doc").single("attachment"),
  updateLeaveRequest,
);

// Route to cancel a leave request (The user himself)
/**
 * @swagger
 * /api/leave-requests/{id}:
 *   delete:
 *     tags:
 *       - Leave Requests
 *     summary: Cancel a leave request (only by the owner while pending)
 *     description: It allows the owner of a leave request to cancel it while it's still pending (not marked as reviewed, approved or rejected yet).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Leave request ID
 *     responses:
 *       200:
 *         description: Leave request cancelled successfully
 *       400:
 *         description: Leave request cannot be cancelled
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Leave request not found
 *       500:
 *         description: Server error
 */
router.delete("/leave-requests/:id", authenticate, cancelLeaveRequest);

export default router;
