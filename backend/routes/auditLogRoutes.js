import express from "express";
import {
  getRecentAuditLogs,
  getAllAuditLogs,
  getAllActions,
} from "../controllers/auditLogController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Audit Logs
 *     description: Endpoints for retrieving audit logs
 */

// Route to get the 5 most recent audit logs (Admin Only)
/**
 * @swagger
 * /api/audit-logs/recent:
 *   get:
 *     tags:
 *       - Audit Logs
 *     summary: Get the 5 most recent audit logs
 *     description: Returns the latest 5 audit logs, formatted for the frontend (Admin only).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved recent audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     example: 63fa2b6e1a2f8b1f12345678
 *                   adminId:
 *                     type: string
 *                     example: 63fa2b6e1a2f8b1f87654321
 *                   adminName:
 *                     type: string
 *                     example: Admin User
 *                   action:
 *                     type: string
 *                     example: CREATE_USER
 *                   entityType:
 *                     type: string
 *                     example: User
 *                   entityId:
 *                     type: string
 *                     example: New Employee
 *                   description:
 *                     type: string
 *                     example: Created New Employee Account
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     example: 2026-03-10T12:34:56.789Z
 *       401:
 *         description: Missing/Invalid Token
 *       403:
 *         description: Unauthorized
 *       500:
 *         description: Server Error
 */
router.get(
  "/audit-logs/recent",
  authenticate,
  authorize(["Admin"]),
  getRecentAuditLogs,
);

// Route to get all paginated audit logs (Admin Only)
/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     tags:
 *       - Audit Logs
 *     summary: Get all audit logs with pagination and optional filters
 *     description: Returns all audit logs, paginated (Admin only).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of logs per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Text search on action, target name, or target type
 *       - in: query
 *         name: admin
 *         schema:
 *           type: string
 *         description: Filter by admin ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter logs created after this date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter logs created before this date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Successfully retrieved paginated audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       adminId:
 *                         type: string
 *                       adminName:
 *                         type: string
 *                       action:
 *                         type: string
 *                       entityType:
 *                         type: string
 *                       entityId:
 *                         type: string
 *                       description:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *       401:
 *         description: Missing/Invalid Token
 *       403:
 *         description: Unauthorized
 *       500:
 *         description: Server Error
 */
router.get("/audit-logs", authenticate, authorize(["Admin"]), getAllAuditLogs);

// Route to get all possible actions (Admin Only)
router.get(
  "/audit-logs/actions",
  authenticate,
  authorize(["Admin"]),
  getAllActions,
);

export default router;
