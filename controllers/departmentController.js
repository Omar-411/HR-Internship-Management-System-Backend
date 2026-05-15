import * as departmentService from "../services/departmentService.js";
import { logAuditAction } from "../utils/logger.js";

// Get all Departments (Admin only)
export const getAllDepartments = async (req, res, next) => {
  try {
    const result = await departmentService.getDepartments(req.query);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get a Department by Id
export const getDepartmentById = async (req, res, next) => {
  try {
    const result = await departmentService.getDepartmentById(req.params.id);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Add new Department Functionnality
export const addDepartment = async (req, res, next) => {
  try {
    const result = await departmentService.createDepartmentService(
      req.body,
      req.user,
    );

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "CREATE_DEPARTMENT",
      targetType: "Department",
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

// Update a Department
export const updateDepartment = async (req, res, next) => {
  try {
    const result = await departmentService.updateDepartmentService(
      req.params.id,
      req.body,
      req.user,
    );

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "UPDATE_DEPARTMENT",
      targetType: "Department",
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

// Delete a Department (All admins can do it)
export const deleteDepartment = async (req, res, next) => {
  try {
    const deletedDepartment = await departmentService.deleteDepartmentService(
      req.params.id,
      req.user,
    );

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "DELETE_DEPARTMENT",
      targetType: "Department",
      targetId: deletedDepartment.data._id,
      targetName: deletedDepartment.data.name,
      ipAddress: req.ip,
    });

    res.status(deletedDepartment.code).json(deletedDepartment);
  } catch (err) {
    next(err);
  }
};
