import express from "express";
import {
  login,
  verifyUser,
  resendVerificationCode,
  resetPassword,
  requestPasswordReset,
  forgetPassword,
} from "../controllers/authController.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Endpoints for the full authentification system
 */

// Route to log the user
/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: User Login
 *     tags:
 *       - Auth
 *     description: Allows a user to login with their email and password to the platform.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Successful login (Could include OTP verification and/or Reset Password after login)
 *       401:
 *         description: Invalid Credentials (Invalid email or password)
 *       403:
 *         description: Account Blocked 
 *       404:
 *         description: User Role not found
 *       500:
 *         description: Server error
 */
router.post("/users/login", authLimiter, login);

// Route to verify user's OTP code
/**
 * @swagger
 * /api/users/verify-user:
 *   post:
 *     summary: Verify user's OTP code
 *     tags: 
 *       - Auth
 *     description: Verifies the OTP code sent to the user's email and activates the account.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 description: User email
 *               code:
 *                 type: string
 *                 description: OTP verification code sent to the email
 *     responses:
 *       200:
 *         description: Account verified successfully with the OTP code
 *       400:
 *         description: Account already verified | Invalid OTP code | OTP Code expired
 *       404:
 *         description: User role not found
 *       500:
 *         description: Server Error
 */
router.post("/users/verify-user", verifyUser);

// Route to resend OTP code
/**
 * @swagger
 * /api/users/resend-verification:
 *   post:
 *     summary: Resend OTP verification code
 *     tags: 
 *      - Auth
 *     description: Sends a new OTP code to the user's email if the resend limit is not exceeded.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 description: User email
 *     responses:
 *       200:
 *         description: OTP code resent successfully
 *       400:
 *         description: Account already verified 
 *       404:
 *         description: User not found
 *       429:
 *         description: Maximum resend limit reached (Too many requests)
 *       500:
 *         description: Server Error
 */
router.post("/users/resend-verification", resendVerificationCode);

// Route to reset password
/**
 * @swagger
 * /api/users/reset-password:
 *   post:
 *     summary: Reset password after account verification
 *     tags: 
 *      - Auth
 *     description: Allows a verified user to set a new password after first login.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 description: User email
 *               newPassword:
 *                 type: string
 *                 description: New password for the account
 *     responses:
 *       200:
 *         description: Password Reset successfully
 *       400:
 *         description: Password reset not required | Invalid password format
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.post("/users/reset-password", resetPassword);

// Route to forget password request
/**
 * @swagger
 * /api/users/request-password-reset:
 *   post:
 *     summary: Request password reset link
 *     tags: 
 *        - Auth
 *     description: Sends a password reset link to the user's email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 description: User email address
 *     responses:
 *       200:
 *         description: Password reset link sent successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.post("/users/request-password-reset", requestPasswordReset);

// Route to forget password reset
/**
 * @swagger
 * /api/users/forget-password:
 *   post:
 *     summary: Reset password using reset token
 *     tags: 
 *      - Auth
 *     description: Allows a user to reset their password using the reset token received via email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - token
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 description: User email
 *               token:
 *                 type: string
 *                 description: Password reset token received via email
 *               newPassword:
 *                 type: string
 *                 description: New password for the account
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token | Invalid password format
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.post("/users/forget-password", forgetPassword);

export default router;
