import AuditLog from "../models/AuditLog.js";

// Format Audit logs for the frontend
const formatAuditLog = (log) => {
  let description = "";

  // Format description based on action and target
  switch (log.action) {
    case "DELETE_USER":
      description = `Deleted User ${log.target_name || ""}`;
      break;
    case "UPDATE_ROLE":
      description = `Updated Role Permissions for ${log.target_name || ""}`;
      break;
    case "CREATE_USER":
      description = `Created ${log.target_name ? log.target_name + " " : ""}Account`;
      break;
    case "UPLOAD_IMAGE":
      description = `Uploaded ${log.target_name || "a user"}'s Profile Image`;
      break;
    case "REMOVE_IMAGE":
      description = `Removed ${log.target_name || "a user"}'s Profile Image`;
      break;
    case "UPDATE_USER":
      description = `Updated User ${log.target_name || ""}`;
      break;
    case "TOGGLE_STATUS":
      description = `Changed System Settings`;
      if (log.details && log.details.status) {
        description = `Changed ${log.target_name || "user"}'s Status to ${log.details.status}`;
      }
      break;
    case "CREATE_DEPARTMENT":
      description = `Created Department ${log.target_name || ""}`;
      break;
    case "UPDATE_DEPARTMENT":
      description = `Updated Department ${log.target_name || ""}`;
      break;
    case "DELETE_DEPARTMENT":
      description = `Deleted Department ${log.target_name || ""}`;
      break;
    case "CREATE_ROLE":
      description = `Created Role ${log.target_name || ""}`;
      break;
    case "DELETE_ROLE":
      description = `Deleted Role ${log.target_name || ""}`;
      break;
    case "CREATE_LEAVE_TYPE":
      description = `Added Leave Type ${log.target_name || ""}`;
      break;
    case "UPDATE_LEAVE_TYPE":
      description = `Updated Leave Type ${log.target_name || ""}`;
      break;
    case "ARCHIVE_LEAVE_TYPE":
      description = `Archived Leave Type ${log.target_name || ""}`;
      break;
    case "RESTORE_LEAVE_TYPE":
      description = `Restored Leave Type ${log.target_name || ""}`;
      break;
    case "MARK_LEAVE_REQUEST_UNDER_REVIEW":
      description = `Marked the Leave Request of ${log.target_name || ""} as Under Review`;
      break;
    case "APPROVE_LEAVE_REQUEST":
      description = `Approved the Leave Request of ${log.target_name || ""}`;
      break;
    case "REJECT_LEAVE_REQUEST":
      description = `Rejected the Leave Request of ${log.target_name || ""}`;
      break;
    case "CREATE_DOCUMENT_TYPE":
      description = `Created Document Type ${log.target_name || ""}`;
      break;
    case "UPDATE_DOCUMENT_TYPE":
      description = `Updated Document Type ${log.target_name || ""}`;
      break;
    case "REQUEST_CLARIFICATION":
      description = `Requested Clarification on Resignation of ${log.target_name || ""}`;
      break;
    case "APPROVE_RESIGNATION":
      description = `Approved Resignation of ${log.target_name || ""}`;
      break;
    case "VALIDATE_PAYROLL":
      description = `Validated Payroll for ${log.target_name || ""}`;
      break;
    case "MARK_PAYROLL_AS_PAID":
      description = `Marked Payroll as Paid for ${log.target_name || ""}`;
      break;
    case "RECOMPUTE_PAYROLL":
      description = `Recomputed Payroll for ${log.target_name || ""}`;
      break;
    case "ASSIGN_ALLOWANCE":
      description = `Assigned Allowance to ${log.target_name || ""}`;
      break;
    case "TOGGLE_ALLOWANCE_ACTIVATION":
      description = `Toggled Allowance Activation for ${log.target_name || ""}`;
      break;
    case "UPDATE_ALLOWANCE":
      description = `Updated Allowance for ${log.target_name || ""}`;
      break;
    case "ASSIGN_BONUS":
      description = `Assigned Bonus to ${log.target_name || ""}`;
      break;
    case "TOGGLE_BONUS_ACTIVATION":
      description = `Toggled Bonus Activation for ${log.target_name || ""}`;
      break;
    case "UPDATE_BONUS":
      description = `Updated Bonus for ${log.target_name || ""}`;
      break;
    case "CREATE_ALLOWANCE_TYPE":
      description = `Created Allowance Type ${log.target_name || ""}`;
      break;
    case "TOGGLE_ALLOWANCE_TYPE_ACTIVATION":
      description = `Toggled Activation for Allowance Type ${log.target_name || ""}`;
      break;
    case "UPDATE_ALLOWANCE_TYPE":
      description = `Updated Allowance Type ${log.target_name || ""}`;
      break;
    case "CREATE_BONUS_TYPE":
      description = `Created Bonus Type ${log.target_name || ""}`;
      break;
    case "TOGGLE_BONUS_TYPE_ACTIVATION":
      description = `Toggled Activation for Bonus Type ${log.target_name || ""}`;
      break;
    case "UPDATE_BONUS_TYPE":
      description = `Updated Bonus Type ${log.target_name || ""}`;
      break;
    case "CREATE_PAYROLL_CONFIG":
      description = `Created Payroll Configuration for ${log.target_name || ""}`;
      break;
    case "TOGGLE_PAYROLL_CONFIG_ACTIVATION":
      description = `Toggled Activation for Payroll Configuration of ${log.target_name || ""}`;
      break;
    case "CREATE_NEW_PAYROLL_CONFIG_VERSION":
      description = `Created New Version of Payroll Configuration for ${log.target_name || ""}`;
      break;
    case "UPLOAD_ADMIN_DOCUMENT":
      description = `Uploaded Administrative Document ${log.target_name || ""}`;
      break;
    case "DELETE_ADMIN_DOCUMENT":
      description = `Deleted Administrative Document ${log.target_name || ""}`;
      break;
    case "GENERATE_DOCUMENT":
      description = `Generated Document ${log.target_name || ""}`;
      break;
    case "SEND_GENERATED_DOCUMENT_BY_EMAIL":
      description = `Sent Generated Document ${log.target_name || ""} by Email`;
      break;
    case "PROCESS_FINAL_SETTLEMENT":
      description = `Processed Final Settlement for ${log.target_name || ""}`;
      break;
    case "MARK_ALERT_UNDER_REVIEW":
      description = `Marked Alert of ${log.target_name || ""} as Under Review`;
      break;
    case "RESOLVE_ALERT":
      description = `Resolved Alert of ${log.target_name || ""}`;
      break;
    case "DISMISS_ALERT":
      description = `Dismissed Alert of ${log.target_name || ""}`;
      break;
    default:
      description = `Performed ${log.action} on ${log.target_type || "Target"}`;
  }

  // Also fallback description if provided explicitly in details
  if (log.details && log.details.description) {
    description = log.details.description;
  }

  return {
    _id: log._id,
    adminId: log.admin_id?._id,
    adminName: log.admin_id
      ? `${log.admin_id.name} ${log.admin_id.lastName || ""}`.trim()
      : "System",
    action: log.action,
    entityType: log.target_type,
    entityId: log.target_name || log.target_id,
    description: description,
    createdAt: log.createdAt,
  };
};

// Get the 5 most recent audit logs
export const getRecentAuditLogs = async (req, res, next) => {
  try {
    // Fetch the 5 most recent audit logs
    const logs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("admin_id", "name lastName email") // Populate admin details if needed
      .lean();

    // Format the output to match the frontend expected structure
    const formattedLogs = logs.map(formatAuditLog);

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Recent audit logs retrieved successfully!",
      data: formattedLogs,
    });
  } catch (error) {
    next(error);
  }
};

// Get all audit logs with pagination and filters
export const getAllAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, search, admin, action, startDate, endDate } = req.query;

    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const limit = 20;

    // Calculate how many documents to skip based on the current page and limit
    const skip = (parsedPage - 1) * limit;

    const query = {};

    // Filter by specific Admin name/ID
    if (admin && admin.trim() !== "") {
      if (admin.match(/^[0-9a-fA-F]{24}$/)) {
        query.admin_id = admin;
      }
    }

    // Filter by Action Type
    if (action && action !== "All Actions") {
      query.action = action;
    }

    // Date Range
    if (startDate || endDate) {
      query.createdAt = {};

      if (startDate) query.createdAt.$gte = new Date(startDate);

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Search text (Action, Type, Details)
    if (search) {
      query.$or = [
        { action: { $regex: search, $options: "i" } },
        { target_name: { $regex: search, $options: "i" } },
        { target_type: { $regex: search, $options: "i" } },
      ];
    }

    // Fetch logs and total count for pagination
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("admin_id", "name lastName email")
        .lean(),

      AuditLog.countDocuments(query),
    ]);

    // Format similarly to recent logs
    const formattedLogs = logs.map(formatAuditLog);

    res.status(200).json({
      status: "Success",
      code: 200,
      data: formattedLogs,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(total / limit),
        limitPerPage: limit,
        totalCount: total,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all actions
export const getAllActions = async (req, res, next) => {
  try {
    const actions = AuditLog.schema.path("action").enumValues;

    res.status(200).json({
      status: "Success",
      code: 200,
      message: "Audit log actions retrieved successfully!",
      data: actions,
    });
  } catch (err) {
    next(err);
  }
};
