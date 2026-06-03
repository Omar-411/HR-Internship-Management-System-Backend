import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";
import AppError from "./AppError.js";
import { errors as userRoleErrors } from "../errors/userRoleErrors.js";
import { errors as departmentErrors } from "../errors/departmentErrors.js";
import { errors as userErrors } from "../errors/userErrors.js";

// Resolve role -> role_id
export const resolveRoleId = async (role) => {
  const userrole = await UserRole.findOne({
    name: { $regex: new RegExp(`^${role}$`, "i") },
  });

  if (!userrole) {
    throw new AppError(
      userRoleErrors.USER_ROLE_NOT_FOUND.message,
      userRoleErrors.USER_ROLE_NOT_FOUND.code,
      userRoleErrors.USER_ROLE_NOT_FOUND.errorCode,
      userRoleErrors.USER_ROLE_NOT_FOUND.suggestion
    );
  }

  return userrole._id;
};

// Resolve department -> department_id
export const resolveDepartmentId = async (department) => {
  const userdepartment = await Department.findOne({
    name: { $regex: new RegExp(`^${department}$`, "i") },
  });

  if (!userdepartment) {
    throw new AppError(
      departmentErrors.DEPARTMENT_NOT_FOUND.message,
      departmentErrors.DEPARTMENT_NOT_FOUND.code,
      departmentErrors.DEPARTMENT_NOT_FOUND.errorCode,
      departmentErrors.DEPARTMENT_NOT_FOUND.suggestion
    );
  }

  return userdepartment._id;
};

// Resolve supervisor_email -> supervisor_id
export const resolveSupervisorIdByEmail = async (email) => {
  if (!email) return null;
  const supervisor = await User.findOne({ email: email });
  if (!supervisor) {
    throw new AppError(
      userErrors.SUPERVISOR_NOT_FOUND.message,
      userErrors.SUPERVISOR_NOT_FOUND.code,
      userErrors.SUPERVISOR_NOT_FOUND.errorCode,
      userErrors.SUPERVISOR_NOT_FOUND.suggestion
    );
  }

  return supervisor._id;
};

// Resolve supervisor_id -> validate existence
export const resolveSupervisorId = async (id) => {
  if (!id) return null;
  const supervisorExists = await User.exists({ _id: id });
  if (!supervisorExists) {
    throw new AppError(
      userErrors.SUPERVISOR_NOT_FOUND.message,
      userErrors.SUPERVISOR_NOT_FOUND.code,
      userErrors.SUPERVISOR_NOT_FOUND.errorCode,
      userErrors.SUPERVISOR_NOT_FOUND.suggestion
    );
  }

  return id;
};
