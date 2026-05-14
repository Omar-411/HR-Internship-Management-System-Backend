import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Alert from "../models/Alert.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import { errors } from "../errors/authErrors.js";
import { errors as userErrors } from "../errors/userErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import AppError from "../utils/AppError.js";
import { generateRandomCode } from "../utils/generateCode.js";
import { isEmpty } from "../validators/userValidators.js";
import {
  generateToken,
  getUserRoleName,
  consumeFaceEnrollmentPrompt,
} from "../utils/authHelpers.js";
import { validateUserStatus } from "../validators/authValidators.js";
import { createNotificationForAdmins } from "../utils/notificationHelpers.js";
import { createNotification } from "./notificationService.js";

// The login service
export const loginService = async ({ email, password }) => {
  const trimmedEmail = (email || "").trim().toLowerCase();
  const trimmedPassword = (password || "").trim();

  // Check the user existence
  const user = await User.findOne({
    email: trimmedEmail,
  });
  if (!user)
    throw new AppError(
      errors.INVALID_CREDENTIALS.message,
      errors.INVALID_CREDENTIALS.code,
      errors.INVALID_CREDENTIALS.errorCode,
      errors.INVALID_CREDENTIALS.suggestion,
    );

  validateUserStatus(user);

  // If the user typed the wrong password 3 times, block the account
  const isMatch = await bcrypt.compare(trimmedPassword, user.password);
  if (!isMatch) {
    user.loginAttempts += 1;

    if (user.loginAttempts > 3) {
      user.status = "Blocked";
      await user.save();

      // Create an alert to be sent to HR Admin about the blocked account
      await Alert.create({
        senderId: null,
        isSystemGenerated: true,
        recipientType: "HR_DEPARTMENT",
        recipientId: null,
        alertType: "TECHNICAL",
        subject: `Account Blocked: ${user.name} ${user.lastName}`,
        description: `The account with email ${user.email} has been blocked after 3 unsuccessful login attempts. Please review the account status and take necessary actions.`,
      });

      // Create a notification for all admin users about the blocked account
      await createNotificationForAdmins({
        type: "ACCOUNT",
        title: "Account Blocked",
        message: `${user.name} ${user.lastName}'s account has been blocked after 3 failed login attempts.`,
        data: {
          entityType: "USER",
          entityId: user._id,
        },
      });

      throw new AppError(
        errors.ACCOUNT_BLOCKED.message,
        errors.ACCOUNT_BLOCKED.code,
        errors.ACCOUNT_BLOCKED.errorCode,
        errors.ACCOUNT_BLOCKED.suggestion,
      );
    }

    await user.save();
    throw new AppError(
      errors.INVALID_CREDENTIALS.message,
      errors.INVALID_CREDENTIALS.code,
      errors.INVALID_CREDENTIALS.errorCode,
      errors.INVALID_CREDENTIALS.suggestion,
    );
  }

  if (user.status !== "Active") {
    return { type: "OTP_REQUIRED" };
  }

  if (user.mustResetPassword) {
    return { type: "RESET_PASSWORD_REQUIRED" };
  }

  const roleName = await getUserRoleName(user.role_id);
  const token = generateToken(user._id, roleName);
  const requiresFaceEnrollment = consumeFaceEnrollmentPrompt(user);

  user.loginAttempts = 0;
  await user.save();

  return {
    status: "Success",
    code: 200,
    message: "Logged in successfully!",
    data: {
      token,
      userId: user.publicId,
      role: roleName,
      slug: user.slug,
      requiresFaceEnrollment,
    },
  };
};

// Activate the user account with OTP code
export const verifyUserService = async ({ email, code }) => {
  const user = await User.findOne({ email });
  if (!user)
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );

  validateUserStatus(user);

  if (user.status === "Active") {
    throw new AppError(
      errors.ACCOUNT_ALREADY_VERIFIED.message,
      errors.ACCOUNT_ALREADY_VERIFIED.code,
      errors.ACCOUNT_ALREADY_VERIFIED.errorCode,
      errors.ACCOUNT_ALREADY_VERIFIED.suggestion,
    );
  }

  const isValid = await bcrypt.compare(code, user.verificationCode);
  if (!isValid)
    throw new AppError(
      errors.INVALID_OTP.message,
      errors.INVALID_OTP.code,
      errors.INVALID_OTP.errorCode,
      errors.INVALID_OTP.suggestion,
    );

  if (user.verificationCodeExpires < Date.now()) {
    throw new AppError(
      errors.OTP_EXPIRED.message,
      errors.OTP_EXPIRED.code,
      errors.OTP_EXPIRED.errorCode,
      errors.OTP_EXPIRED.suggestion,
    );
  }

  user.status = "Active";
  user.verificationCode = null;
  user.verificationCodeExpires = null;
  user.mustResetPassword = true;

  const roleName = await getUserRoleName(user.role_id);
  const token = generateToken(user._id, roleName);
  const requiresFaceEnrollment = consumeFaceEnrollmentPrompt(user);

  await user.save();

  // Create a welcome notification for the user about the successful account verification
  await createNotification({
    recipientId: user._id,
    type: "ACCOUNT",
    title: `Welcome to HRcoM, ${user.name}!`,
    message: "Your account has been successfully verified. Welcome aboard!",
    data: {
      entityType: "USER",
      entityId: user._id,
    },
  });

  return {
    status: "Success",
    code: 200,
    message: "Account verified successfully!",
    data: {
      token,
      userId: user.publicId,
      role: roleName,
      slug: user.slug,
      requiresPasswordChange: user.mustResetPassword,
      requiresFaceEnrollment,
    },
  };
};

// Resend the OTP code (3 attempts per day max)
export const resendOTPService = async ({ email }) => {
  const trimmedEmail = (email || "").trim().toLowerCase();

  const user = await User.findOne({ email: trimmedEmail });
  if (!user)
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );

  validateUserStatus(user);

  if (user.status === "Active") {
    throw new AppError(
      errors.ACCOUNT_ALREADY_VERIFIED.message,
      errors.ACCOUNT_ALREADY_VERIFIED.code,
      errors.ACCOUNT_ALREADY_VERIFIED.errorCode,
      errors.ACCOUNT_ALREADY_VERIFIED.suggestion,
    );
  }

  const today = new Date();
  const lastResend = user.resendDate ? new Date(user.resendDate) : null;

  if (!lastResend || today.toDateString() !== lastResend.toDateString()) {
    user.resendCount = 0;
    user.resendDate = today;
  }

  if (user.resendCount >= 3) {
    throw new AppError(
      errors.MAX_RESEND_REACHED.message,
      errors.MAX_RESEND_REACHED.code,
      errors.MAX_RESEND_REACHED.errorCode,
      errors.MAX_RESEND_REACHED.suggestion,
    );
  }

  const otp = generateRandomCode(6);
  user.verificationCode = await bcrypt.hash(otp, 10);
  user.verificationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  user.resendCount += 1;

  await user.save();

  await sendEmail({
    to: user.email,
    subject: "New Verification Code",
    type: "resendOTP",
    name: user.name,
    code: otp,
  });

  return {
    status: "Success",
    code: 200,
    message: "Verification code re-sent successfully!",
  };
};

// Reset the password for users who are required to reset
export const resetPasswordService = async ({ email, newPassword }) => {
  // Check the user existence
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user)
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );

  validateUserStatus(user);

  if (!user.mustResetPassword) {
    throw new AppError(
      errors.RESET_NOT_REQUIRED.message,
      errors.RESET_NOT_REQUIRED.code,
      errors.RESET_NOT_REQUIRED.errorCode,
      errors.RESET_NOT_REQUIRED.suggestion,
    );
  }

  if (isEmpty(newPassword))
    throw new AppError(
      errors.MISSING_PASSWORD.message,
      errors.MISSING_PASSWORD.code,
      errors.MISSING_PASSWORD.errorCode,
      errors.MISSING_PASSWORD.suggestion,
    );

  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword)) {
    throw new AppError(
      errors.WEAK_PASSWORD.message,
      errors.WEAK_PASSWORD.code,
      errors.WEAK_PASSWORD.errorCode,
      errors.WEAK_PASSWORD.suggestion,
    );
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.mustResetPassword = false;

  const roleName = await getUserRoleName(user.role_id);
  const token = generateToken(user._id, roleName);
  const requiresFaceEnrollment = consumeFaceEnrollmentPrompt(user);

  await user.save();

  return {
    status: "Success",
    code: 200,
    message: "Password reset successfully!",
    data: {
      token,
      userId: user.publicId,
      role: roleName,
      slug: user.slug,
      requiresFaceEnrollment,
    },
  };
};

// Request the password reset link with OTP code (For the forget password)
export const requestPasswordResetService = async ({ email }) => {
  // Check the user existence
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user)
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );

  validateUserStatus(user);

  const rawToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;

  await user.save();

  const resetURL = `${process.env.PLATFORM_URL}/reset-password?token=${rawToken}&email=${user.email}`;

  await sendEmail({
    to: user.email,
    subject: "Password Reset",
    type: "forgetPasswordRequest",
    name: user.name,
    resetLink: resetURL,
  });

  return {
    status: "Success",
    code: 200,
    message: "Password reset link sent successfully!",
  };
};

// Forget the password service
export const forgetPasswordService = async ({ email, token, newPassword }) => {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Check the user existence with the token and its expiration
  const user = await User.findOne({
    email: email.trim().toLowerCase(),
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user)
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );

  validateUserStatus(user);

  if (isEmpty(newPassword))
    throw new AppError(
      errors.MISSING_PASSWORD.message,
      errors.MISSING_PASSWORD.code,
      errors.MISSING_PASSWORD.errorCode,
      errors.MISSING_PASSWORD.suggestion,
    );

  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword)) {
    throw new AppError(
      errors.WEAK_PASSWORD.message,
      errors.WEAK_PASSWORD.code,
      errors.WEAK_PASSWORD.errorCode,
      errors.WEAK_PASSWORD.suggestion,
    );
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  user.status = "Active";
  user.mustResetPassword = false;

  const roleName = await getUserRoleName(user.role_id);
  const tokenGen = generateToken(user._id, roleName);
  const requiresFaceEnrollment = consumeFaceEnrollmentPrompt(user);

  await user.save();

  return {
    status: "Success",
    code: 200,
    message: "Password reset successfully!",
    data: {
      token: tokenGen,
      userId: user.publicId,
      role: roleName,
      slug: user.slug,
      requiresFaceEnrollment,
    },
  };
};
