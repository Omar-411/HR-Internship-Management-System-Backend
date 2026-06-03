import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import { getAll } from "./handlersFactory.js";
import { resolveRoleId, resolveDepartmentId } from "../utils/userResolvers.js";
import { SENSITIVE_FIELDS } from "../constants/userConstants.js";

// Get all active supervisors
export const getActiveSupervisors = async (queryParams) => {
  // Find the supervisor role
  const roles = await UserRole.find({
    name: { $in: [/^HR$/i, /^Supervisor$/i] },
  });
  const roleIds = roles.map((r) => r._id);

  const finalQuery = {
    ...queryParams,
    status: "Active",
    role_id: { in: roleIds },
  };

  // Resolve the department name - Id if we applied a department filter
  if (finalQuery.department) {
    finalQuery.department_id = await resolveDepartmentId(finalQuery.department);
    
    delete finalQuery.department;
  }

  // Run the generic getAll function + Add the extra filters to get the list of active supervisors
  return getAll(User, null, SENSITIVE_FIELDS)(finalQuery);
};

// Get the 3 recent supervisors
export const getRecentSupervisors = async (queryParams) => {  
  const supervisorRoleId = await resolveRoleId("Supervisor");

  const finalQuery = {
    ...queryParams,
    role_id: supervisorRoleId,
    sort: "-createdAt",
    limit: 3,
  };
  
  // Run the generic getAll function + Add the extra filters to get the list of recent supervisors
  return getAll(User, null, SENSITIVE_FIELDS)(finalQuery);
};
