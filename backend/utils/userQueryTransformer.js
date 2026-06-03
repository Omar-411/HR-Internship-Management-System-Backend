// A helper function to map: role -> role_id and department -> department_id in the query parameters
import { resolveRoleId, resolveDepartmentId } from "../utils/userResolvers.js";

export const transformUserFilters = async (queryParams) => {
  const newQuery = { ...queryParams };

  if (newQuery.role) {
    newQuery.role_id = await resolveRoleId(newQuery.role);
    delete newQuery.role;
  }

  if (newQuery.department) {
    newQuery.department_id = await resolveDepartmentId(newQuery.department);
    delete newQuery.department;
  }

  if (newQuery.supervisorId) {
    newQuery.supervisor_id = newQuery.supervisorId;
    delete newQuery.supervisorId;
  }

  if (newQuery.search) {
    const regex = new RegExp(newQuery.search, "i");
    newQuery._searchCondition = [{ name: regex }, { email: regex }];
    delete newQuery.search;
  }

  if (newQuery.status) {
    // Capitalize the first letter (active -> Active) to match backend enum
    newQuery.status = newQuery.status.charAt(0).toUpperCase() + newQuery.status.slice(1);
  }

  return newQuery;
};
