import jwt from "jsonwebtoken";
import UserRole from "../models/UserRole.js";
import { errors } from "../errors/userRoleErrors.js";
import AppError from "./AppError.js";

// JWT token generation
export const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role }, 
    process.env.JWT_SECRET, {
    expiresIn: "10h",
  });
};

// Get the user role name by role ID
export const getUserRoleName = async (roleId) => {
  const role = await UserRole.findById(roleId);
  if (!role) throw new AppError(
    errors.USER_ROLE_NOT_FOUND.message,
    errors.USER_ROLE_NOT_FOUND.code,
    errors.USER_ROLE_NOT_FOUND.errorCode,
    errors.USER_ROLE_NOT_FOUND.suggestion
  );
  
  return role.name;
};

// Check if the user needs to be prompted for face enrollment and consume the prompt
export const consumeFaceEnrollmentPrompt = (user) => {
  return user.faceEnrollmentPromptRequired === true;
};
