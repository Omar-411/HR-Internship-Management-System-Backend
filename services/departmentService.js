import Department from "../models/Department.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { errors } from "../errors/departmentErrors.js";
import {
  getOne,
  getAll,
  createOne,
  updateOne,
  deleteOne,
} from "./handlersFactory.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";

// Get all departments
export const getDepartments = async (queryParams) => {
  const finalQuery = {
    sort: "name",
    limit: 100,
    ...queryParams,
  };
  return await getAll(Department)(finalQuery);
};

// Get a department by ID
export const getDepartmentById = getOne(
  Department,
  errors.DEPARTMENT_NOT_FOUND,
);

// Add a new department
export const createDepartmentService = async ({ name, description }, currentUser) => {
  // Validate the name field
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new AppError(
      errors.DEPARTMENT_NAME_REQUIRED.message,
      errors.DEPARTMENT_NAME_REQUIRED.code,
      errors.DEPARTMENT_NAME_REQUIRED.errorCode,
      errors.DEPARTMENT_NAME_REQUIRED.suggestion,
    );
  }

  // Check for existing department with the same name
  const existing = await Department.findOne({ name: trimmedName });
  if (existing) {
    throw new AppError(
      errors.DEPARTMENT_ALREADY_EXISTS.message,
      errors.DEPARTMENT_ALREADY_EXISTS.code,
      errors.DEPARTMENT_ALREADY_EXISTS.errorCode,
      errors.DEPARTMENT_ALREADY_EXISTS.suggestion,
    );
  }

  const department = await createOne(Department)({
    name: trimmedName,
    description,
  });

  // Notify all admins except the one who created the role
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: currentUser.id,
      type: "DEPARTMENT",
      title: "New Department Created",
      message: `A new department "${trimmedName}" has been created.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for new department creation:",
      err,
    );
  }

  return department;
};

// Update a department
export const updateDepartmentService = async (id, { name, description }, currentUser) => {
  // Validate the name field
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new AppError(
      errors.DEPARTMENT_NAME_REQUIRED.message,
      errors.DEPARTMENT_NAME_REQUIRED.code,
      errors.DEPARTMENT_NAME_REQUIRED.errorCode,
      errors.DEPARTMENT_NAME_REQUIRED.suggestion,
    );
  }

  // Check for department existence
  const department = await Department.findById(id);
  if (!department) {
    throw new AppError(
      errors.DEPARTMENT_NOT_FOUND.message,
      errors.DEPARTMENT_NOT_FOUND.code,
      errors.DEPARTMENT_NOT_FOUND.errorCode,
      errors.DEPARTMENT_NOT_FOUND.suggestion,
    );
  }

  // Store the old department name for notification purposes
  const oldDepartmentName = department.name;

  // Check the department name uniqueness
  const existing = await Department.findOne({ name: trimmedName });
  if (existing && existing._id.toString() !== id) {
    throw new AppError(
      errors.DEPARTMENT_ALREADY_EXISTS.message,
      errors.DEPARTMENT_ALREADY_EXISTS.code,
      errors.DEPARTMENT_ALREADY_EXISTS.errorCode,
      errors.DEPARTMENT_ALREADY_EXISTS.suggestion,
    );
  }

  // Update the department
  const updatedDepartment = await updateOne(Department)(id, {
    name: trimmedName,
    description,
  });

  // Notify all admins except the one who updated the department
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: currentUser.id,
      type: "DEPARTMENT",
      title: "Department Updated",
      message: `The department "${oldDepartmentName}" has been updated.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for department update:",
      err,
    );
  }

  return updatedDepartment;
};

// Delete a department
export const deleteDepartmentService = async (id, currentUser) => {
  // Check for department existence
  const department = await Department.findById(id);
  if (!department) {
    throw new AppError(
      errors.DEPARTMENT_NOT_FOUND.message,
      errors.DEPARTMENT_NOT_FOUND.code,
      errors.DEPARTMENT_NOT_FOUND.errorCode,
      errors.DEPARTMENT_NOT_FOUND.suggestion,
    );
  }

  // Ensure fallback department exists
  let fallbackDepartment = await Department.findOne({ name: "Not assigned" });
  if (!fallbackDepartment) {
    fallbackDepartment = await Department.create({
      name: "Not assigned",
      description: "Default department for unassigned users",
    });
  }

  // Reassign users
  await User.updateMany(
    { department_id: department._id },
    { $set: { department_id: fallbackDepartment._id } },
  );

  const deletedDepartment = await deleteOne(Department)(id);

  // Notify all admins except the one who deleted the department
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: currentUser.id,
      type: "DEPARTMENT",
      title: "Department Deleted",
      message: `The department "${department.name}" has been deleted.`,
      data: {
        entityType: null,
        entityId: null,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for department deletion:",
      err,
    );
  }

  return deletedDepartment; // Return the deleted department for audit logging
};
