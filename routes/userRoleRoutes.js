import express from "express";
import {
 
    addUserRole,
    getAllUserRoles,
    getUserRoleById,
    deleteUserRole,
    updateUserRole
} from "../controllers/userRoleController.js";
import authorizeRole from "../middleware/rolePermission.js";
 
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";


const router = express.Router();

// Add new role
/**
 * @swagger
 * /api/v0/roles:
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
 
 *             $ref: '#/components/schemas/UserRole'
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
 *         description: Server error
 */
router.post("/roles", authorizeRole("Admin"), addUserRole);


  
router.post("/roles", authenticate, authorize(["Admin"]), addUserRole);

// Get all roles

/**
 * @swagger
 * /api/v0/roles:
 *   get:
 
 *     summary: Get all user roles
 *     description: Retrieve a list of all roles
 *     tags:
 *       - Roles
 *     responses:
 *       200:
 *         description: List of roles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserRole'
 *       500:
 *         description: Server error
 */
router.get("/roles", authenticate, authorize(["Admin"]), getAllUserRoles);

// Get a role by ID

/**
 * @swagger
 * /api/v0/roles/{id}:
 *   get:
 
 *     summary: Get role by ID
 *     description: Retrieve a specific role by its ID
 *     tags:
 *       - Roles
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserRole'
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.get("/roles/:id", getUserRoleById);

/**
 * @swagger
 * /api/v0/roles/{id}:
 *   delete:
 *     summary: Delete a user role
 *     description: Delete a role by ID (Admin only)
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 
 *         schema:
 *           type: string
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: User Role not found
 *       500:
 *         description: Server error
 */
router.delete("/roles/:id", authorizeRole("Admin"), deleteUserRole);


  
router.get("/roles/:id", authenticate, authorize(["Admin"]), getUserRoleById);

// Update a role

/**
 * @swagger
 * /api/roles/{id}:
 *   put:
 *     summary: Update a user role (Admin only)
 *     description: Allows an Admin to update the details of a user role.
 *     tags:
 *       - UserRoles
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
 *             $ref: '#/components/schemas/UserRole'
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: User Role not found
 *       409:
 *         description: User Role already exists
 *       500:
 *         description: Server error
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

