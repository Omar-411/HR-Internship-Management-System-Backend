import express from "express";
import {
  addUser,
  updateUser,
  deleteUser,
  getAllUsers,
  getActiveSupervisorsController,
  getRecentSupervisorsController,
  getUserById,
  toggleUserStatus,
  exportUsersToCSV,
  exportUsersToExcel,
  uploadProfileImage,
  removeProfileImage,
  enrollFace,
  resetFace,
  getPublicInterns,
} from "../controllers/userController.js";
import { upload } from "../middleware/upload.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: Endpoints for the users CRUDs
 */

// Public interns listing for marketing site
router.get("/public/interns", getPublicInterns);

// Route to get all users (Admin Only)
/**
 * @swagger
 * /api/users:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get all users (Admin only)
 *     description: Allows an admin to retrieve the list of all the users in the platform.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns list of users
 *       500:
 *         description: Server error
 */
router.get(
  "/users", 
  authenticate, 
  authorize(["Admin", "Supervisor"]), 
  getAllUsers
);

// Route to Add user (Admin Only)
/**
 * @swagger
 * /api/users:
 *   post:
 *     tags:
 *       - Users
 *     summary: Add a new user (Admin only)
 *     description: Allows an admin to create a new user in the system.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Failed Input validation
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Role not found | Department not found | Supervisor not found
 *       409:
 *         description: User already exists in the DB
 *       500:
 *         description: Server error
 */
router.post(
  "/users", 
  authenticate, 
  authorize(["Admin"]), 
  addUser
);

// Route to Update user (Edit Profile) (Admin Only and the user himself)
/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     tags:
 *       - Users
 *     summary: Update an existing user (Admin only)
 *     description: Allows an admin to update the details of an existing user or the user himself to update his profile.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Input Validation failed
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized (Insufficient permissions)
 *       404:
 *         description: User not found | Role not found | Department not found | Supervisor not found
 *       409:
 *         description: User already exists in the DB
 *       500:
 *         description: Server error
 */
router.put(
  "/users/:id",
  authenticate,
  authorize(["Admin"], { allowSelf: true }),
  updateUser
);

// Route to Delete user (Admin Only)
/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags:
 *       - Users
 *     summary: Delete a user (Admin only)
 *     description: Allows an admin to delete a user from the platform.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/users/:id",
  authenticate,
  authorize(["Admin"]),
  deleteUser
);

// Route to get active supervisors (Admin Only)
/**
 * @swagger
 * /api/users/active-supervisors:
 *  get:
 *    summary: Get all active supervisors (Admin only)
 *    description: Allows an admin to retrieve the list of all active supervisors in the system.
 *    tags:
 *     - Users 
 *  security:
 *    - bearerAuth: []
 *  responses:
 *   200:
 *    description: Returns list of available and active supervisors
 *   401:
 *    description: Invalid/missing token
 *   403:
 *    description: Unauthorized
 *   404:
 *    description: Supervisor role not found | Department not found (if department filter applied)
 *   500:
 *    description: Server error
 * */
router.get(
  "/users/active-supervisors", 
  authenticate, 
  authorize(["Admin"]), 
  getActiveSupervisorsController
);

// Route to get the 3 recent supervisors (Admin Only)
/**
 * @swagger
 * /api/users/recent-supervisors:
 *   get:
 *     summary: Get recent supervisors (Admin only)
 *     description: Allows to retrieve the 3 most recently created supervisors in the system.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved recent supervisors
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Supervisor role not found
 *       500:
 *         description: Server Error
 */
router.get(
  "/users/recent-supervisors", 
  authenticate, 
  authorize(["Admin"]), 
  getRecentSupervisorsController
);

// Route to get user by ID 
/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get a user by ID (Admin, the user himself, his supervisor and all his collegues in the same project)
 *     description: Allows the requester to retrieve the details of user by Id.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns the user data
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get(
  "/users/:id",
  authenticate,
  getUserById
);

// Route to toggle user status
/**
 * @swagger
 * /api/users/{id}/toggle-status:
 *   put:
 *     tags:
 *       - Users
 *     summary: Toggle user Active/Inactive status (Admin only)
 *     description: Allows an admin to toggle the user status between active and inactive.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status toggled successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put(
  "/users/:id/toggle-status",
  authenticate,
  authorize(["Admin"]),
  toggleUserStatus
);

// Route to export users to CSV
/**
 * @swagger
 * /api/users/export/csv:
 *   get:
 *     tags:
 *       - Users
 *     summary: Export all users to CSV (Admin only)
 *     description: Allows an admin to export the list of all users in the CSV format.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file that contains the list of users in the platform
 *       500:
 *         description: Server error
 */
router.get(
  "/users/export/csv",
  authenticate,
  authorize(["Admin"]),
  exportUsersToCSV
);

// Route to export users to Excel
/**
 * @swagger
 * /api/users/export/excel:
 *   get:
 *     tags:
 *       - Users
 *     summary: Export all users to Excel (Admin only)
 *     description: Allows an admin to export the list of all users in the Excel format.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file that contains the list of users in the platform
 *       500:
 *         description: Server error
 */
router.get(
  "/users/export/excel",
  authenticate,
  authorize(["Admin"]),
  exportUsersToExcel
);

// Route to upload profile image
/**
 * @swagger
 * /api/users/{id}/profile-image:
 *   post:
 *     tags:
 *       - Users
 *     summary: Upload a profile image for a user
 *     description: Allows an admin or the user himself to upload a profile image for the user (Uploaded to cloudinary).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profileImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile Image uploaded successfully
 *       400:
 *         description: No file uploaded
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  "/users/:id/profile-image",
  authenticate,
  authorize(["Admin"], { allowSelf: true }),
  upload("image").single("profileImage"),
  uploadProfileImage
);

// Route to delete profile image
/**
 * @swagger
 * /api/users/{id}/profile-image:
 *   delete:
 *     summary: Remove a user's profile image (Admin Only and the user himself)
 *     description: Allows the admin or the user himself to delete the user's profile image from Cloudinary and removes it from the user's profile.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the user whose profile image will be removed
 *         schema:
 *           type: string
 *           example: 6652b9b7c87f2a8a4f5d1a2c
 *     responses:
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.delete(
  "/users/:id/profile-image",
  authenticate,
  authorize(["Admin"], { allowSelf: true }),
  removeProfileImage
);

// Route to enroll face descriptors
/**
 * @swagger
 * /api/users/{id}/face-enrollment:
 *   post:
 *     summary: Enroll face descriptors for a user (Admin Only and the user himself)
 *     description: Allows a user to enroll the face descriptors for identification purposes.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the user to enroll face for
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - descriptors
 *             properties:
 *               descriptors:
 *                 type: array
 *                 items:
 *                   type: array
 *                   items:
 *                     type: number
 *                 description: Array of face descriptors (each is an array of 128 numbers)
 *     responses:
 *       200:
 *         description: Face descriptors enrolled successfully
 *       400:
 *         description: Invalid descriptions data
 *       401:
 *         description: Invalid/missing token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 *     
 */
router.post(
  "/users/:id/face-enrollment",
  authenticate,
  authorize(["Admin"], { allowSelf: true }),
  enrollFace
);

// Route to reset face descriptors
/**
 * @swagger
 * /api/users/{id}/reset-face:
 *   post:
 *     summary: Reset a user's Face ID
 *     description: Allows an admin to reset the Face ID of any user. Users can reset their own Face ID.
 *     tags: 
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user whose Face ID will be reset
 *     responses:
 *       200:
 *         description: Face ID reset successfully
 *         content: 
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: Success
 *                 message:
 *                   type: string
 *                   example: Face ID reset successfully!
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized 
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.post(
  "/users/:id/reset-face",
  authenticate,
  authorize(["Admin"], { allowSelf: true }),
  resetFace
);

export default router;
