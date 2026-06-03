import * as userRoleService from "../services/userRoleService.js";
import { logAuditAction } from "../utils/logger.js";

// Get all User roles (Admin only)
export const getAllUserRoles = async (req, res, next) => {
  try {
    const result = await userRoleService.getUserRoles(req.query);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get a Role by Id
export const getUserRoleById = async (req, res, next) => {
  try {
    const result = await userRoleService.getUserRoleById(req.params.id);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Add new Role Functionnality
export const addUserRole = async (req, res, next) => {
  try {
    const result = await userRoleService.createUserRoleService(
      req.body,
      req.user,
    );

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "CREATE_ROLE",
      targetType: "UserRole",
      targetId: result.data._id,
      targetName: result.data.name,
      details: req.body,
      ipAddress: req.ip,
    });

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Update a User Role
export const updateUserRole = async (req, res, next) => {
  try {
    const result = await userRoleService.updateUserRoleService(
      req.params.id,
      req.body,
      req.user,
    );

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "UPDATE_ROLE",
      targetType: "UserRole",
      targetId: result.data._id,
      targetName: result.data.name,
      details: req.body,
      ipAddress: req.ip,
    });

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Delete a User Role (All admins can do it)
export const deleteUserRole = async (req, res, next) => {
  try {
    const deletedRole = await userRoleService.deleteUserRoleService(
      req.params.id,
      req.user,
    );

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "DELETE_ROLE",
      targetType: "UserRole",
      targetId: deletedRole.data._id,
      targetName: deletedRole.data.name,
      ipAddress: req.ip,
    });

    res.status(deletedRole.code).json(deletedRole);
  } catch (err) {
    next(err);
  }
};
