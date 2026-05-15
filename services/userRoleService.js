import UserRole from "../models/UserRole.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { errors } from "../errors/userRoleErrors.js";
import {
  getOne,
  getAll,
  createOne,
  updateOne,
  deleteOne,
} from "./handlersFactory.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";

// Get all user roles
export const getUserRoles = async (queryParams) => {
  const finalQuery = {
    sort: "name",
    limit: 100,
    ...queryParams,
  };
  return await getAll(UserRole)(finalQuery);
};

// Get a user role by ID
export const getUserRoleById = getOne(UserRole, errors.USER_ROLE_NOT_FOUND);

// Add a new user role
export const createUserRoleService = async (
  { name, description },
  currentUser,
) => {
  // Validate the name field
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new AppError(
      errors.USER_ROLE_NAME_REQUIRED.message,
      errors.USER_ROLE_NAME_REQUIRED.code,
      errors.USER_ROLE_NAME_REQUIRED.errorCode,
      errors.USER_ROLE_NAME_REQUIRED.suggestion,
    );
  }

  // Check for existing role with the same name
  const existing = await UserRole.findOne({ name: trimmedName });
  if (existing) {
    throw new AppError(
      errors.USER_ROLE_ALREADY_EXISTS.message,
      errors.USER_ROLE_ALREADY_EXISTS.code,
      errors.USER_ROLE_ALREADY_EXISTS.errorCode,
      errors.USER_ROLE_ALREADY_EXISTS.suggestion,
    );
  }

  const role = await createOne(UserRole)({
    name: trimmedName,
    description,
  });

  // Notify all admins except the one who created the role
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: currentUser.id,
      type: "USER_ROLE",
      title: "New User Role Created",
      message: `A new user role "${trimmedName}" has been created.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for new user role creation:",
      err,
    );
  }

  return role;
};

// Update a user role
export const updateUserRoleService = async (
  id,
  { name, description },
  currentUser,
) => {
  // Validate the name field
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new AppError(
      errors.USER_ROLE_NAME_REQUIRED.message,
      errors.USER_ROLE_NAME_REQUIRED.code,
      errors.USER_ROLE_NAME_REQUIRED.errorCode,
      errors.USER_ROLE_NAME_REQUIRED.suggestion,
    );
  }

  // Check for role existence
  const role = await UserRole.findById(id);
  if (!role) {
    throw new AppError(
      errors.USER_ROLE_NOT_FOUND.message,
      errors.USER_ROLE_NOT_FOUND.code,
      errors.USER_ROLE_NOT_FOUND.errorCode,
      errors.USER_ROLE_NOT_FOUND.suggestion,
    );
  }

  // Store the old role name for notification purposes
  const oldRoleName = role.name;

  // Check the user role's name uniqueness
  const existing = await UserRole.findOne({ name: trimmedName });
  if (existing && existing._id.toString() !== id) {
    throw new AppError(
      errors.USER_ROLE_ALREADY_EXISTS.message,
      errors.USER_ROLE_ALREADY_EXISTS.code,
      errors.USER_ROLE_ALREADY_EXISTS.errorCode,
      errors.USER_ROLE_ALREADY_EXISTS.suggestion,
    );
  }

  // Update the role
  const updatedRole = await updateOne(UserRole)(id, {
    name: trimmedName,
    description,
  });

  // Notify all admins except the one who updated the role
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: currentUser.id,
      type: "USER_ROLE",
      title: "User Role Updated",
      message: `The user role "${oldRoleName}" has been updated.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Failed to send notification for user role update:", err);
  }

  return updatedRole;
};

// Delete a user role
export const deleteUserRoleService = async (id, currentUser) => {
  // Check for role existence
  const role = await UserRole.findById(id);
  if (!role) {
    throw new AppError(
      errors.USER_ROLE_NOT_FOUND.message,
      errors.USER_ROLE_NOT_FOUND.code,
      errors.USER_ROLE_NOT_FOUND.errorCode,
      errors.USER_ROLE_NOT_FOUND.suggestion,
    );
  }

  // Store the deleted role name for notification purposes
  const deletedRoleName = role.name;

  // Ensure fallback role exists
  let fallbackRole = await UserRole.findOne({ name: "Not assigned" });
  if (!fallbackRole) {
    fallbackRole = await UserRole.create({
      name: "Not assigned",
      description: "Default role for unassigned users",
    });
  }

  // Reassign users
  await User.updateMany(
    { role_id: role._id },
    { $set: { role_id: fallbackRole._id } },
  );

  const deletedRole = await deleteOne(UserRole)(id);

  // Notify all admins except the one who deleted the role
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: currentUser.id,
      type: "USER_ROLE",
      title: "User Role Deleted",
      message: `The user role "${deletedRoleName}" has been deleted.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error("Failed to send notification for user role deletion:", err);
  }

  return deletedRole; // Return the deleted role for audit logging
};
