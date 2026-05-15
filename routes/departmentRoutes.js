import express from "express";
import {
    addDepartment,
    getAllDepartments,
    getDepartmentById,
    deleteDepartment,
    updateDepartment
} from "../controllers/departmentController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Departments
 *     description: Endpoints for the Department CRUDs
 */
 
// Route to add new department
/**
 * @swagger
 * /api/departments:
 *   post:
 *     summary: Add a new department (Admin Only)
 *     tags:
 *       - Departments
 *     description: Allows an Admin to create a new department.
 *     security:
 *       - bearerAuth: []
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
 *       201:
 *         description: Department created successfully
 *       400:
 *         description: Invalid Input
 *       401:
 *         description: Invalid/missing token
 *       403: 
 *         description: Unauthorized
 *       409:
 *         description: Department already exists
 *       500:
 *         description: Server Error
 */
router.post("/departments", authenticate, authorize(["Admin"]), addDepartment);

// Route to get all the departments
/**
 * @swagger
 * /api/departments:
 *   get:
 *     summary: Get all departments (Admin Only)
 *     tags:
 *       - Departments
 *     description : Allows an Admin to get the list of all departments.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of departments
 *       401:
 *         description: Invalid/missing token
 *       500:
 *         description: Server Error
 */
/*
 * WHAT: Added "Supervisor" to authorize list for GET /departments.
 * WHY: Supervisors need department data to populate the filter dropdown in the Attendance modal.
 *      Write operations remain Admin-only.
 */
router.get("/departments", authenticate, authorize(["Admin", "Supervisor"]), getAllDepartments);


// Route to get a department by Id
/**
 * @swagger
 * /api/departments/{id}:
 *   get:
 *     summary: Get a single department by ID (Admin Only)
 *     tags:
 *       - Departments
 *     description: Allows an Admin to get the details of a single department (Admin Only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Retrieve the department details
 *       401:
 *         description: Invalid/missing token
 *       403: 
 *         description: Unauthorized
 *       404:
 *         description: Department not found
 *       500:
 *         description: Server Error
 */
router.get("/departments/:id", authenticate, authorize(["Admin"]), getDepartmentById);

// Route to delete a department
/**
 * @swagger
 * /api/departments/{id}:
 *   delete:
 *     summary: Delete a department (Admin only)
 *     tags:
 *       - Departments
 *     description: Allows an Admin to delete a department.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Department deleted successfully
 *       401:
 *         description: Invalid/missing token
 *       403: 
 *         description: Unauthorized
 *       404:
 *         description: Department not found
 *       500:
 *         description: Server Error
 */
router.delete("/departments/:id", authenticate, authorize(["Admin"]), deleteDepartment);

// Route to update a department
/**
 * @swagger
 * /api/departments/{id}:
 *   put:
 *     summary: Update a department (Admin only)
 *     tags:
 *       - Departments
 *     description: Allows an Admin to update a department.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
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
 *         description: Department updated successfully
 *       400:
 *         description: Invalid Input
 *       401:
 *         description: Invalid/missing token
 *       403: 
 *         description: Unauthorized
 *       404:
 *         description: Department not found
 *       409:
 *         description: Department already exists
 *       500:
 *         description: Server Error
 */
router.put("/departments/:id", authenticate, authorize(["Admin"]), updateDepartment);

export default router;
