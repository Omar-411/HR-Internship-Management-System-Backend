import express from "express";
import {
  addUserRole,
  getAllUserRoles,
  getUserRoleById,
  updateUserRole,
  deleteUserRole,
} from "../controllers/userRoleController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: UserRoles
 *     description: Endpoints for the user roles CRUDs
 */

// Add new role
/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Create a new user role (Admin Only)
 *     tags:
 *       - UserRoles
 *     description: Allows the Admin to add a new user role.
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
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: User Role created successfully
 *       400:
 *         description: Role Name must be filled
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       409:
 *         description: User Role already exists
 *       500:
 *         description: Server Error
 */
router.post("/roles", authenticate, authorize(["Admin"]), addUserRole);

// Get all roles
/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Get all user roles (Admin only)
 *     tags:
 *       - UserRoles
 *     description: Allows an Admin to get the list of all user roles.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns list of roles
 *       401:
 *         description: Missing Token
 *       403:
 *         description: Unauthorized
 *       500:
 *         description: Server Error
 */
router.get("/roles", authenticate, authorize(["Admin", "HR"]), getAllUserRoles);

// Get a role by ID
/**
 * @swagger
 * /api/roles/{id}:
 *   get:
 *     summary: Get a user role by ID (Admin only)
 *     tags:
 *       - UserRoles
 *     description: Allows an Admin to get the details of a user role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the role to retrieve
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns the user role details
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User Role not found
 *       500:
 *         description: Server Error
 */
router.get("/roles/:id", authenticate, authorize(["Admin"]), getUserRoleById);

// Update a role
/**
 * @swagger
 * /api/roles/{id}:
 *   put:
 *     summary: Update a user role (Admin only)
 *     tags:
 *       - UserRoles
 *     description: Allows an Admin to update the details of a user role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the role to update
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User Role not found
 *       409:
 *         description: User Role already exists
 *       500:
 *         description: Server Error
 */
router.put("/roles/:id", authenticate, authorize(["Admin"]), updateUserRole);

// Delete a role
/**
 * @swagger
 * /api/roles/{id}:
 *   delete:
 *     summary: Delete a user role (Admin only)
 *     tags:
 *       - UserRoles
 *     description: Allows an Admin to delete a user role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the role to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User Role deleted successfully
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User Role not found
 *       500:
 *         description: Server Error
 */
router.delete("/roles/:id", authenticate, authorize(["Admin"]), deleteUserRole);

export default router;
