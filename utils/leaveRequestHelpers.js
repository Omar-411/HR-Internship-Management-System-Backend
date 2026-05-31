import { getStatusesByRole } from "./leaveStatusByRole.js";
import AppError from "../utils/AppError.js";
import { errors } from "../errors/leaveRequestErrors.js";
import { errors as tokenErrors } from "../errors/middlewareTokenErrors.js";

// Build the query for fetching leave requests based on the user's role and provided query parameters
export const buildLeaveRequestQuery = (user, queryParams) => {
  const { typeId, status, month, year } = queryParams;

  let roleFilter = {};
  const userRole = (user.role || "").toString().trim().toLowerCase();
  const allowedStatuses = getStatusesByRole(userRole);
  const userId = user._id || user.id;

  // ROLE FILTER
  if (userRole === "supervisor") {
    roleFilter = {
      $or: [
        {
          supervisorId: userId,
          status: { $in: allowedStatuses },
        },
        {
          employeeId: userId,
        },
      ],
    };
  } else if (userRole === "admin") {
    roleFilter = {
      status: { $in: allowedStatuses },
    };
  } else if (userRole === "employee" || userRole === "intern") {
    roleFilter = {
      employeeId: userId,
    };
  } else {
    throw new AppError(
      tokenErrors.UNAUTHORIZED.message,
      tokenErrors.UNAUTHORIZED.code,
      tokenErrors.UNAUTHORIZED.errorCode,
      tokenErrors.UNAUTHORIZED.suggestion,
    );
  }

  // THE OTHER FILTERS
  let filters = {};

  // Filter by the leave request type
  if (typeId) filters.typeId = typeId;

  // Filter by the leave request status
  if (status) {
    if (!allowedStatuses.includes(status)) {
      throw new AppError(
        errors.INVALID_STATUS_PER_ROLE.message,
        errors.INVALID_STATUS_PER_ROLE.code,
        errors.INVALID_STATUS_PER_ROLE.errorCode,
        errors.INVALID_STATUS_PER_ROLE.suggestion,
      );
    }
    filters.status = status;
  }

  // Filter by month and year (for the startDate and endDate)
  if (month || year) {
    if (!year) {
      throw new AppError(
        errors.YEAR_REQUIRED.message,
        errors.YEAR_REQUIRED.code,
        errors.YEAR_REQUIRED.errorCode,
        errors.YEAR_REQUIRED.suggestion,
      );
    }

    const parsedMonth = parseInt(month) - 1 || 0;
    const parsedYear = parseInt(year);

    const startDate = new Date(parsedYear, parsedMonth, 1);
    const endDate = new Date(parsedYear, parsedMonth + 1, 0, 23, 59, 59);

    filters.startDate = { $lte: endDate };
    filters.endDate = { $gte: startDate };
  }

  return {
    $and: [roleFilter, filters],
  };
};
