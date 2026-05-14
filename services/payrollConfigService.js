import PayrollConfig from "../models/PayrollConfig.js";
import { createOne, getAll, getOne } from "./handlersFactory.js";
import { errors } from "../errors/payrollConfigErrors.js";
import AppError from "../utils/AppError.js";
import { logAuditAction } from "../utils/logger.js";
import { validatePayrollConfig } from "../validators/payrollConfigValidators.js";
import { createNotificationForAdminsExcept } from "../utils/notificationHelpers.js";

const createPayrollConfigFactory = createOne(PayrollConfig);

// Create a new payroll configuration for a specific year
export const createPayrollConfig = async (data, user, ip) => {
  // Check if there's already an active configuration for the specified year
  const existingActive = await PayrollConfig.findOne({
    year: data.year,
    isActive: true,
  });
  if (existingActive) {
    throw new AppError(
      errors.ACTIVE_PAYROLL_CONFIG_EXISTS.message,
      errors.ACTIVE_PAYROLL_CONFIG_EXISTS.code,
      errors.ACTIVE_PAYROLL_CONFIG_EXISTS.errorCode,
      errors.ACTIVE_PAYROLL_CONFIG_EXISTS.suggestion,
    );
  }

  validatePayrollConfig(data);

  // Create a config
  const config = await createPayrollConfigFactory({
    ...data,
    isActive: true,
  });

  // Create the audit log for this action
  await logAuditAction({
    adminId: user.id,
    action: "CREATE_PAYROLL_CONFIG",
    targetType: "PayrollConfig",
    targetId: config.data._id,
    targetName: `${config.data.year}`,
    details: config,
    ipAddress: ip,
  });

  // Notify all admins except the one who created the role
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "PAYROLL_CONFIG",
      title: "New Payroll Configuration Created",
      message: `A new payroll configuration for ${config.data.year} has been created.`,
      data: {
        entityType: "PayrollConfig",
        entityId: config.data._id,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for new payroll configuration creation:",
      err,
    );
  }

  return config;
};

// Get all payroll configurations
export const getAllConfigs = async (queryParams) => {
  return await getAll(PayrollConfig)(queryParams);
};

// Get the active payroll configuration for a specific year
export const getActivePayrollConfig = async (year) => {
  const config = await PayrollConfig.findOne({ year, isActive: true });
  if (!config) {
    throw new AppError(
      errors.PAYROLL_CONFIG_NOT_FOUND.message,
      errors.PAYROLL_CONFIG_NOT_FOUND.code,
      errors.PAYROLL_CONFIG_NOT_FOUND.errorCode,
      errors.PAYROLL_CONFIG_NOT_FOUND.suggestion,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Active payroll configuration retrieved successfully!",
    data: config,
  };
};

// Create a new version of the current payroll configuration for a specific year
export const createNewVersion = async (newConfig, user, ip) => {
  validatePayrollConfig(newConfig);

  // Find the current highest version for this year
  const latestConfig = await PayrollConfig.findOne({ year: newConfig.year })
    .sort("-version")
    .select("version");

  const nextVersion = (latestConfig?.version || 1) + 1;

  // Deactivate the current active config
  await PayrollConfig.updateMany(
    { year: newConfig.year, isActive: true },
    { isActive: false },
  );

  // create new version
  const config = await createOne(PayrollConfig)({
    ...newConfig,
    year: newConfig.year,
    version: nextVersion,
    isActive: true,
  });

  // Create the audit log for this action
  await logAuditAction({
    adminId: user.id,
    action: "CREATE_NEW_PAYROLL_CONFIG_VERSION",
    targetType: "PayrollConfig",
    targetId: config.data._id,
    targetName: `${config.data.year} (v${nextVersion})`,
    details: config,
    ipAddress: ip,
  });

  // Notify all admins except the one who created the new payroll version
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "PAYROLL_CONFIG",
      title: "New Payroll Configuration version Created",
      message: `A new payroll configuration version for ${config.data.year} has been created.`,
      data: {
        entityType: "PayrollConfig",
        entityId: config.data._id,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for new payroll configuration creation:",
      err,
    );
  }

  return config;
};

// Get all versions for a specific year
export const getYearVersions = async (year) => {
  const versions = await PayrollConfig.find({ year }).sort("-version");
  return {
    status: "Success",
    code: 200,
    message: `All versions for ${year} retrieved successfully!`,
    data: versions,
  };
};

// Toggle the activation status of a payroll configuration
export const togglePayrollConfigActivation = async (id, user, ip) => {
  // Check the payroll config existence
  const config = await PayrollConfig.findById(id);
  if (!config)
    throw new AppError(
      errors.PAYROLL_CONFIG_NOT_FOUND.message,
      errors.PAYROLL_CONFIG_NOT_FOUND.code,
      errors.PAYROLL_CONFIG_NOT_FOUND.errorCode,
      errors.PAYROLL_CONFIG_NOT_FOUND.suggestion,
    );

  // Deactivate all others for this year (Only one active config per year is allowed)
  await PayrollConfig.updateMany({ year: config.year }, { isActive: false });

  config.isActive = !config.isActive;
  await config.save();

  // Create the audit log for this action
  await logAuditAction({
    adminId: user.id,
    action: "TOGGLE_PAYROLL_CONFIG_ACTIVATION",
    targetType: "PayrollConfig",
    targetId: config._id,
    targetName: `${config.year}`,
    details: config,
    ipAddress: ip,
  });

  // Notify all admins except the one who toggled the payroll activation status
  try {
    await createNotificationForAdminsExcept({
      excludedUserId: user.id,
      type: "PAYROLL_CONFIG",
      title: "Payroll Configuration Activation Toggled",
      message: `The activation status of the payroll configuration for ${config.year} has been toggled.`,
      data: {
        entityType: "PayrollConfig",
        entityId: config._id,
      },
    });
  } catch (err) {
    console.error(
      "Failed to send notification for payroll configuration activation toggle:",
      err,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Payroll configuration activation toggled successfully!",
    data: config,
  };
};
