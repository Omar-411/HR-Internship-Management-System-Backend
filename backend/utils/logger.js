import AuditLog from "../models/AuditLog.js";

/**
 * Utility to log administrative actions for auditing purposes.
 *
 * @param {Object} params - The logging parameters.
 * @param {string} params.adminId - The ID of the admin performing the action.
 * @param {string} params.action - The type of action performed (from AuditLog schema enum).
 * @param {string} params.targetType - The type of resource targeted (User, Department, UserRole).
 * @param {string} params.targetId - The ID of the targeted resource.
 * @param {string} [params.targetName] - The name/identifier of the target for easier reading.
 * @param {Object} [params.details] - Any additional metadata or change details.
 * @param {string} [params.ipAddress] - The client's IP address.
 */
export const logAuditAction = async ({
  adminId,
  action,
  targetType,
  targetId,
  targetName,
  details = {},
  ipAddress,
}) => {
  try {
    const logEntry = new AuditLog({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      target_name: targetName,
      details,
      ipAddress,
    });

    await logEntry.save();
    console.log(
      `[Audit-LOG] ${action} performed by ${adminId} on ${targetType} ${targetId}`,
    );
  } catch (error) {
    // We don't throw the error to avoid breaking the main functionality if logging fails
    console.error(
      "[Audit-LOG-Error] Failed to save audit log entry:",
      error.message,
    );
  }
};
