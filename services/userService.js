import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Document from "../models/Document.js";
import LeaveType from "../models/LeaveType.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors } from "../errors/userErrors.js";
import AppError from "../utils/AppError.js";
import bcrypt from "bcrypt";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";
import { getOne, getAll } from "./handlersFactory.js";
import {
  isValidEmail,
  validateUserData,
  fullPhoneNumberValidation,
  fullCINPassportValidation,
} from "../validators/userValidators.js";
import { generateRandomCode } from "../utils/generateCode.js";
import {
  uploadImageToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";
import {
  resolveRoleId,
  resolveDepartmentId,
  resolveSupervisorIdByEmail,
  resolveSupervisorId,
} from "../utils/userResolvers.js";
import { sendEmail } from "../utils/sendEmail.js";
import { logAuditAction } from "../utils/logger.js";
import { buildQuery } from "../utils/queryBuilder.js";
<<<<<<< HEAD
import { SENSITIVE_FIELDS } from "../constants/userConstants.js";
import { createNotification } from "./notificationService.js";
=======
import { resolveId } from "../utils/idResolver.js";

// Sensitive fields that must never leave the backend
const SENSITIVE_FIELDS = "-password -verificationCode -verificationCodeExpires -resetPasswordToken -resetPasswordExpires -loginAttempts -resendCount -resendDate -mustResetPassword";
>>>>>>> e5d4ec0c82ea2d8caab3e5ca76315f0406b7f62f

const ROLE_SALARY_DEFAULTS = {
  employee: 1800,
  supervisor: 3500,
  admin: 5500,
};

// Get a single user by Id
export const getUser = getOne(
  User,
  commonErrors.USER_NOT_FOUND,
  [
    { path: "role_id", select: "name" },
    { path: "department_id", select: "name" },
    { path: "supervisor_id", select: "name lastName email" },
  ],
  SENSITIVE_FIELDS,
);

// Get all users
export const getUsers = async (queryParams) => {
  const { _searchCondition, ...otherParams } = queryParams;

  // Build the basic query using the generic builder
  let query = buildQuery(User, otherParams);

  // Apply the custom search condition if present (avoids JSON stringification issues)
  if (_searchCondition) {
    query = query.find({ $or: _searchCondition });
  }

  // Populate relations
  query = query.populate([
    { path: "role_id", select: "name" },
    { path: "department_id", select: "name" },
    { path: "supervisor_id", select: "name lastName email" },
  ]);

  // Select fields (exclude sensitive data)
  query = query.select(`-faceDescriptors ${SENSITIVE_FIELDS}`);

  // Pagination logic
  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 10;
  const skip = (page - 1) * limit;

  // Get total count based on the current filters for accurate pagination
  const filter = query.getQuery();
  const totalCount = await User.countDocuments(filter);

  // Execute final query with pagination
  query = query.skip(skip).limit(limit);
  const users = await query;

  return {
    status: "Success",
    code: 200,
    message: "List of users retrieved successfully!",
    data: users,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      limitPerPage: limit,
      totalCount,
    },
  };
};

// Create a new user
export const addUserService = async (data, currentUser, ip) => {
  const {
    name,
    lastName,
    email,
    gender,
    dateOfBirth,
    placeOfBirth,
    idType, // Passport or CIN
    idCountryCode, // Passport or CIN country code
    idNumber, // Passport or CIN number
    issueDate, // Passport or CIN issue date
    issuePlace, // Passport or CIN issue place
    address,
    joinDate,
    countryCode, // Country code for the phone number
    phoneNumber,
    position,
    bonus,
    bio,
    socialStatus,
    hasChildren,
    nbOfChildren,
    status, // Select List (Pending, Active, Inactive, Blocked)
    isAvailable,
    role,
    department,
    supervisor_email, // Pass the supervisor email instead of the full name for avoiding duplicate issues
    supervisor_id,
    profileImageURL,
    contractJoinDate,
    contractEndDate,
    contractType,
    salary,
  } = data;

  const trimmedEmail = (email || "").trim().toLowerCase();
  const trimmedSupervisorEmail = (supervisor_email || "").trim().toLowerCase();
  const trimmedIdNumber = (idNumber || "").trim();

  // Check the user existence
  const existingUser = await User.findOne({
    $or: [{ email: trimmedEmail }, { "idNumber.number": trimmedIdNumber }],
  });
  if (existingUser) {
    throw new AppError(
      errors.USER_ALREADY_EXISTS.message,
      errors.USER_ALREADY_EXISTS.code,
      errors.USER_ALREADY_EXISTS.errorCode,
      errors.USER_ALREADY_EXISTS.suggestion,
    );
  }

  // Input Validations
  validateUserData({
    name,
    lastName,
    trimmedEmail,
    trimmedSupervisorEmail,
    address,
    position,
    bonus,
    bio,
    hasChildren,
    nbOfChildren,
    gender,
    dateOfBirth,
    placeOfBirth,
    contractJoinDate,
    contractEndDate,
    salary,
  });

  // Check the phone number validity
  const validatedPhoneNumber = fullPhoneNumberValidation(
    countryCode,
    phoneNumber,
  );

  // Check the uniqueness of the phone number
  const existingPhoneUser = await User.findOne({
    phoneNumber: validatedPhoneNumber,
  });
  if (existingPhoneUser) {
    throw new AppError(
      errors.PHONE_NUMBER_UNAVAILABLE.message,
      errors.PHONE_NUMBER_UNAVAILABLE.code,
      errors.PHONE_NUMBER_UNAVAILABLE.errorCode,
      errors.PHONE_NUMBER_UNAVAILABLE.suggestion,
    );
  }

  // Check the CIN/Passport validity
  fullCINPassportValidation(
    idType,
    idCountryCode,
    trimmedIdNumber,
    issueDate,
    issuePlace,
  );

  // Resolve role, department and supervisor
  const roleId = await resolveRoleId(role);
  const departmentId = await resolveDepartmentId(department);

  // Supervisor resolution: prefer ID if provided, otherwise resolve email
  let resolvedSupervisorId = null;
  if (supervisor_id) {
    resolvedSupervisorId = await resolveSupervisorId(supervisor_id);
  } else if (trimmedSupervisorEmail) {
    resolvedSupervisorId = await resolveSupervisorIdByEmail(
      trimmedSupervisorEmail,
    );
  }

  // Password + OTP Code generation
  const password = generateRandomCode();
  const otpCode = generateRandomCode(6);

  const hashedPassword = await bcrypt.hash(password, 10);
  const hashedOTP = await bcrypt.hash(otpCode, 10);

  const finalProfileImageURL =
    typeof profileImageURL === "string" ? profileImageURL : "";

  // Handle salary defaults
  const roleLower = (role || "").toLowerCase();
  let baseSalary = salary?.base;
  if (roleLower !== "intern" && (baseSalary === undefined || baseSalary === null)) {
    baseSalary = ROLE_SALARY_DEFAULTS[roleLower] || 0;
  }

  // Creation of the user
  const user = await User.create({
    name,
    lastName,
    gender,
    email: trimmedEmail,
    dateOfBirth,
    placeOfBirth,
    idType,
    idNumber: {
      number: trimmedIdNumber,
      countryCode: idCountryCode,
      issueDate,
      issuePlace,
    },
    password: hashedPassword,
    verificationCode: hashedOTP,
    verificationCodeExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    address,
    joinDate,
    phoneNumber: validatedPhoneNumber,
    position,
    bonus,
    bio,
    socialStatus,
    hasChildren,
    nbOfChildren,
    status: status || "Pending",
    isAvailable,
    role_id: roleId,
    department_id: departmentId,
    supervisor_id: resolvedSupervisorId,
    profileImageURL: finalProfileImageURL,
    employment: {
      contractJoinDate,
      contractEndDate,
<<<<<<< HEAD
      contractType: "CDD", // Default value, will be updated later
=======
      contractType: contractType || "CDI",
>>>>>>> e5d4ec0c82ea2d8caab3e5ca76315f0406b7f62f
    },
    salary: roleLower === "intern" ? undefined : { base: baseSalary || 0, currency: "DT" },
  });

  // Initialize the leave balances for the user based on role
  const leaveTypes = await LeaveType.find({ status: "Active" });

  // Intern-specific leave policy
  const INTERN_ALLOWED = ["Annual Leave", "Sick Leave", "Personal"];
  const INTERN_DEFAULTS = {
    "Annual Leave": 13,
    "Sick Leave": 8,
    Personal: 3,
  };

  const leaveBalances =
    role === "Intern"
      ? leaveTypes
          .filter((type) => INTERN_ALLOWED.includes(type.name))
          .map((type) => ({
            typeId: type._id,
            remainingDays: INTERN_DEFAULTS[type.name] ?? type.defaultDays,
          }))
      : leaveTypes.map((type) => ({
          typeId: type._id,
          remainingDays: type.defaultDays,
        }));

  user.leaveBalances = leaveBalances;
  await user.save();

  // Sending the welcome email to the user (Password + OTP Code + Platform link)
  try {
    await sendEmail({
      to: user.email,
      subject: "Welcome to HRcoM!",
      type: "addUser",
      name: user.name,
      password,
      code: otpCode,
    });
  } catch (e) {
    console.log("Email failed:", e.message);
  }

  // Notify the supervisor about the new team member assignment
  if (resolvedSupervisorId) {
    try {
      await createNotification({
        recipientId: resolvedSupervisorId,
        type: "ACCOUNT",
        title: "New Team Member Assigned",
        message: `${user.name} ${user.lastName} has been assigned to you.`,
        data: {
          entityType: "USER",
          entityId: user._id,
        },
      });
    } catch (error) {
      console.log("Notification failed:", error.message);
    }
  }

  // Log the creation action in the audit logs
  try {
    await logAuditAction({
      adminId: currentUser.id,
      action: "CREATE_USER",
      targetType: "User",
      targetId: user._id,
      targetName: `${user.name} ${user.lastName}`,
      ipAddress: ip,
    });
  } catch (e) {
    console.log("Audit failed:", e.message);
  }

  return {
    status: "Success",
    code: 201,
    message: "User created successfully!",
    data: {
      _id: user._id,
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
      role_id: user.role_id,
      department_id: user.department_id,
      joinDate: user.joinDate,
    },
  };
};

// Update an existing user
export const updateUserService = async (id, updateData, currentUser, ip) => {
  // Check the user existence
  const existingUser = await User.findOne(resolveId(id)).populate("role_id");
  if (!existingUser)
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );

<<<<<<< HEAD
  // Store the old supervisor ID for later comparison (if the supervisor is being updated)
  const oldSupervisorId = existingUser.supervisor_id
    ? existingUser.supervisor_id.toString()
    : null;
=======
  const actualId = existingUser._id.toString();
>>>>>>> e5d4ec0c82ea2d8caab3e5ca76315f0406b7f62f

  // Check the email validity and the user existence
  if (updateData.email) {
    const trimmedEmail = updateData.email.trim().toLowerCase();

    if (!isValidEmail(trimmedEmail)) {
      throw new AppError(
        errors.INVALID_EMAIL_FORMAT.message,
        errors.INVALID_EMAIL_FORMAT.code,
        errors.INVALID_EMAIL_FORMAT.errorCode,
        errors.INVALID_EMAIL_FORMAT.suggestion,
      );
    }

    // Check if another user with the same email already exists
    const existingEmailUser = await User.findOne({ email: trimmedEmail });
    if (existingEmailUser && existingEmailUser._id.toString() !== actualId) {
      throw new AppError(
        errors.EMAIL_UNAVAILABLE.message,
        errors.EMAIL_UNAVAILABLE.code,
        errors.EMAIL_UNAVAILABLE.errorCode,
        errors.EMAIL_UNAVAILABLE.suggestion,
      );
    }

    updateData.email = trimmedEmail;
  }

  // Input validation for common fields (those that don't require DB checks)
  validateUserData({
    name: updateData.name,
    lastName: updateData.lastName,
    trimmedEmail: updateData.email,
    trimmedSupervisorEmail: updateData.supervisor_email,
    address: updateData.address,
    position: updateData.position,
    bonus: updateData.bonus,
    bio: updateData.bio,
    hasChildren: updateData.hasChildren,
    nbOfChildren: updateData.nbOfChildren,
    gender: updateData.gender,
    dateOfBirth: updateData.dateOfBirth,
    placeOfBirth: updateData.placeOfBirth,
    contractJoinDate: updateData.employment?.contractJoinDate,
    contractEndDate: updateData.employment?.contractEndDate,
    salary: updateData.salary,
    isAvailable: updateData.isAvailable,
    leaveBalance: updateData.leaveBalance,
  });

  // Check the phone number validity + uniqueness in case of an update
  if (updateData.phoneNumber) {
    // Check the new phone number validity
    const validatedPhoneNumber = fullPhoneNumberValidation(
      updateData.countryCode,
      updateData.phoneNumber,
    );

    // Check the uniqueness of the phone number
    const existingPhoneUser = await User.findOne({
      phoneNumber: validatedPhoneNumber,
    });
    if (existingPhoneUser && existingPhoneUser._id.toString() !== actualId) {
      throw new AppError(
        errors.PHONE_NUMBER_UNAVAILABLE.message,
        errors.PHONE_NUMBER_UNAVAILABLE.code,
        errors.PHONE_NUMBER_UNAVAILABLE.errorCode,
        errors.PHONE_NUMBER_UNAVAILABLE.suggestion,
      );
    }

    updateData.phoneNumber = validatedPhoneNumber;
  }

  // Check the CIN/Passport validity
  if (updateData.idType || updateData.idNumber) {
    let trimmedIdNumber = updateData.idNumber?.number?.trim();
    let idCountryCode = updateData.idNumber?.countryCode;
    let issueDate = updateData.idNumber?.issueDate;
    let issuePlace = updateData.idNumber?.issuePlace;

    fullCINPassportValidation(
      updateData.idType,
      idCountryCode,
      trimmedIdNumber,
      issueDate,
      issuePlace,
    );

    // Force TN for CIN
    if (updateData.idType === "CIN") {
      idCountryCode = "TN";
    }

    // Override the idNumber field
    updateData.idNumber = {
      number: trimmedIdNumber,
      countryCode: idCountryCode,
      issueDate,
      issuePlace,
    };

    // Check if the ID number exists for another user
    const existingIdUser = await User.findOne({
      "idNumber.number": trimmedIdNumber,
      _id: { $ne: actualId },
    });
    if (existingIdUser) {
      throw new AppError(
        errors.USER_ALREADY_EXISTS.message,
        errors.USER_ALREADY_EXISTS.code,
        errors.USER_ALREADY_EXISTS.errorCode,
        errors.USER_ALREADY_EXISTS.suggestion,
      );
    }

    if (updateData.idType === "CIN" && updateData.idNumber) {
      updateData.idNumber.countryCode = "TN";
    }

    updateData.idNumber.number = trimmedIdNumber;
    updateData.idNumber.countryCode = idCountryCode;
    updateData.idNumber.issueDate = issueDate;
    updateData.idNumber.issuePlace = issuePlace;
  }

  // Check the role validity and send the role change email (updateDate.role only exists if the role is being changed)
  let roleChanged = false;
  let newRoleId = null;
  let newRoleName = "";

  // Get the id of the old role
  const oldRoleId = existingUser.role_id;

  if (updateData.role) {
    // Validate the new role and get its ID
    newRoleId = await resolveRoleId(updateData.role);

    // Check if the role is changed
    if (!oldRoleId.equals(newRoleId)) {
      roleChanged = true;

      const roleDoc = await UserRole.findById(newRoleId).select("name");
      newRoleName = roleDoc?.name || "";
      updateData.role_id = newRoleId;
    }

    delete updateData.role;
  }

  // Handle salary updates and defaults
  const roleToUse = (roleChanged ? newRoleName : existingUser.role_id?.name || "").toLowerCase();

  if (roleToUse === "intern") {
    // Remove salary if user is or becomes an intern
    if (roleChanged || updateData.role) {
      updateData.$unset = { ...updateData.$unset, salary: "" };
    }
    delete updateData.salary;
  } else {
    // Not an intern
    if (updateData.salary && updateData.salary.base !== undefined) {
      // Explicit salary update from payload
      updateData.salary = { base: updateData.salary.base, currency: "DT" };
    } else if (roleChanged) {
      // Role changed to non-intern and no explicit salary provided -> apply default
      updateData.salary = { base: ROLE_SALARY_DEFAULTS[roleToUse] || 0, currency: "DT" };
    }
  }

  // Check the department validity
  if (updateData.department) {
    updateData.department_id = await resolveDepartmentId(updateData.department);
    delete updateData.department;
  }

  // Check the supervisor validity
  if (updateData.supervisor_id) {
    await resolveSupervisorId(updateData.supervisor_id);
  } else if (updateData.supervisor_email) {
    const supervisorId = await resolveSupervisorIdByEmail(
      updateData.supervisor_email,
    );
    updateData.supervisor_id = supervisorId;
    delete updateData.supervisor_email;
  } else if (
    "supervisor_email" in updateData ||
    "supervisor_id" in updateData
  ) {
    // Explicitly clearing the supervisor
    updateData.supervisor_id = null;
    if ("supervisor_email" in updateData) delete updateData.supervisor_email;
  }

  // Update the Status of the user
  if (updateData.isActive !== undefined) {
<<<<<<< HEAD
    updateData.status = updateData.isActive ? "Active" : "Inactive";

    // In case the admin unblocked or un-inactivated the user, we reset the login attempts to 0 and send an email
    if (
      updateData.status === "Active" &&
      existingUser.status !== updateData.status
    ) {
      existingUser.loginAttempts = 0;
      await existingUser.save();

      try {
        console.log(
          `[UPDATE-USER-DEBUG] Sending account re-activated email to: ${existingUser.email}`,
        );

        await sendEmail({
          to: existingUser.email,
          subject: "HRcoM! - Your Account Has Been Re-Activated",
          type: "accountReactivation",
          name: existingUser.name,
        });

        console.log(`[UPDATE-USER-DEBUG] Activation Email sent successfully.`);
      } catch (emailErr) {
        console.log(
          `[UPDATE-USER-DEBUG] ACTIVATION EMAIL FAILED:`,
          emailErr.message,
        );
      }
    }

=======
    if (updateData.isActive) {
      updateData.status = "Active";
    } else if (existingUser.status !== "Pending" && existingUser.status !== "Blocked") {
      // Only set to Inactive if it wasn't already a special state
      updateData.status = "Inactive";
    }
>>>>>>> e5d4ec0c82ea2d8caab3e5ca76315f0406b7f62f
    delete updateData.isActive;
  }

  if (updateData.contractType) {
    if (updateData.employment) {
      updateData.employment.contractType = updateData.contractType;
    } else {
      updateData["employment.contractType"] = updateData.contractType;
    }
    delete updateData.contractType;
  }

  // Update the user
  const user = await User.findOneAndUpdate({ _id: actualId }, updateData, {
    returnDocument: "after",
  })
    .select(`-faceDescriptors ${SENSITIVE_FIELDS}`)
    .populate("role_id")
    .populate("department_id")
    .populate("supervisor_id", "name lastName email");

  // Get the new supervisor ID after the update (for comparison with the old supervisor ID)
  const newSupervisorId = user.supervisor_id
    ? user.supervisor_id._id.toString()
    : null;

  // Check if the supervisor is changed
  if (oldSupervisorId !== newSupervisorId) {
    // Notify the old supervisor about the team member removal change (if exists)
    if (oldSupervisorId) {
      try {
        await createNotification({
          recipientId: oldSupervisorId,
          type: "ACCOUNT",
          title: "Team Member Removed",
          message: `${user.name} ${user.lastName} is no longer assigned to you.`,
          // No redirect for this notification, it's just informational
          data: {
            entityType: null,
            entityId: null,
          },
        });
      } catch (error) {
        console.log("Team Member Removal Notification failed:", error.message);
      }
    }

    // Notify the new supervisor
    if (newSupervisorId) {
      await createNotification({
        recipientId: newSupervisorId,
        type: "ACCOUNT",
        title: "New Team Member Assigned",
        message: `${user.name} ${user.lastName} has been assigned to you.`,
        data: {
          entityType: "USER",
          entityId: user._id,
        },
      });
    }
  }

  // Notify the user about the profile update (In case the updater is an Admin, not himself)
  if (
    currentUser.role === "Admin" &&
    currentUser.id.toString() !== user._id.toString()
  ) {
    try {
      await createNotification({
        recipientId: user._id,
        type: "ACCOUNT",
        title: "Profile Updated",
        message: "Your profile information has been updated by HR.",
        data: {
          entityType: "USER",
          entityId: user._id,
        },
      });
    } catch (err) {
      console.log("Profile update notification failed:", err.message);
    }
  }

  // Send the update user email ONLY if role changed
  if (roleChanged) {
    try {
      console.log(
        `[UPDATE-USER-DEBUG] Sending Update user email to: ${user.email}`,
      );

      await sendEmail({
        to: user.email,
        subject: "HRcoM! - Congratulations! Your Role Has Been Updated",
        type: "updateUser",
        name: user.name,
        newRole: user.position,
      });

      console.log(`[UPDATE-USER-DEBUG] Promotion Email sent successfully.`);
    } catch (emailErr) {
      console.log(
        `[UPDATE-USER-DEBUG] PROMOTION EMAIL FAILED:`,
        emailErr.message,
      );
    }
  }

  // Create the audit log for this action
  await logAuditAction({
    adminId: currentUser.id,
    action: "UPDATE_USER",
    targetType: "User",
    targetId: user._id,
    targetName: `${user.name} ${user.lastName}`,
    details: updateData,
    ipAddress: ip,
  });

  return {
    status: "Success",
    code: 200,
    message: "User updated successfully!",
    data: user,
  };
};

// Delete a user
export const deleteUserService = async (userId, currentUser, ip) => {
  // Check user existence
  const user = await User.findOne(resolveId(userId));
  if (!user) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  const actualId = user._id;

  // Get the user's personal documents
  const documents = await Document.find({ user_id: userId });

  // Delete files from Cloudinary
  for (const doc of documents) {
    if (doc.filePublicId) {
      await deleteFromCloudinary(doc.filePublicId);
    }
  }

  // Delete documents from DB
  await Document.deleteMany({ user_id: actualId });

  // Store the supervisor ID before deleting the user (for supervisor notification after deletion)
  const supervisorId = user.supervisor_id;

  // Delete the user
  await User.findByIdAndDelete(actualId);

  if (supervisorId) {
    try {
      await createNotification({
        recipientId: supervisorId,
        type: "ACCOUNT",
        title: "Team Member Removed",
        message: `${user.name} ${user.lastName} has been removed from your team.`,
        data: {
          entityType: null,
          entityId: null,
        },
      });
    } catch (err) {
      console.log("Supervisor user deletion notification failed:", err.message);
    }
  }

  // Audit log the deletion of the user + associated personal documents
  await logAuditAction({
    adminId: currentUser.id,
    action: "DELETE_USER",
    targetType: "User",
    targetId: user._id,
    targetName: `${user.name} ${user.lastName}`,
    ipAddress: ip,
  });

  return {
    status: "Success",
    code: 200,
    message: "User and all associated personal documents deleted successfully!",
  };
};

// Toggle the user status (Active/Inactive)
export const toggleUserStatusService = async (id, currentUser, ip) => {
  // Check the user existence
  const user = await User.findOne(resolveId(id));
  if (!user) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  const oldStatus = user.status;

  user.status = user.status === "Active" ? "Inactive" : "Active";

  if (oldStatus !== "Active" && user.status === "Active") {
    // Send the account re-activation email to the user
    try {
      await sendEmail({
        to: user.email,
        subject: "HRcoM! - Your Account Has Been Re-Activated",
        type: "accountReactivation",
        name: user.name,
      });
    } catch (e) {
      console.log("Email failed:", e.message);
    }
  } else if (oldStatus === "Active" && user.status !== "Active") {
    // Send the account deactivation email to the user
    try {
      await sendEmail({
        to: user.email,
        subject: "HRcoM! - Your Account Has Been Deactivated",
        type: "accountDeactivation",
        name: user.name,
      });
    } catch (e) {
      console.log("Email failed:", e.message);
    }
  }

  await user.save();

  await logAuditAction({
    adminId: currentUser.id,
    action: "TOGGLE_STATUS",
    targetType: "User",
    targetId: user._id,
    targetName: `${user.name} ${user.lastName}`,
    details: { status: user.status },
    ipAddress: ip,
  });

  return {
    status: "Success",
    code: 200,
    message: `User status changed to ${user.status} successfully!`,
    data: await User.findById(user._id)
      .select(`-faceDescriptors ${SENSITIVE_FIELDS}`)
      .populate("role_id", "name")
      .populate("department_id", "name")
      .populate("supervisor_id", "name lastName email"),
  };
};

// Export users to csv
export const exportUsersToCSVService = async (queryParams) => {
  let query = buildQuery(User, queryParams);

  const users = await query
    .populate("role_id", "name")
    .populate("department_id", "name")
    .populate("supervisor_id", "name lastName email")
    .lean();

  const formattedUsers = users.map((user) => ({
    name: user.name,
    lastName: user.lastName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    position: user.position,
    role: user.role_id?.name,
    department: user.department_id?.name,
    status: user.status,
    joinDate: user.joinDate
      ? new Date(user.joinDate).toLocaleDateString("en-GB")
      : "",
  }));

  const fields = [
    "name",
    "lastName",
    "email",
    "phoneNumber",
    "position",
    "role",
    "department",
    "status",
    "joinDate",
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(formattedUsers);

  return csv;
};

// export users to excel
export const exportUsersToExcelService = async (queryParams, res) => {
  const users = await buildQuery(User, queryParams)
    .populate("role_id", "name")
    .populate("department_id", "name")
    .populate("supervisor_id", "name lastName email")
    .lean(); // We use .lean() to get plain JS objects which are easier to work with when generating Excel

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Users");

  sheet.columns = [
    { header: "Name", key: "name", width: 20 },
    { header: "Last Name", key: "lastName", width: 20 },
    { header: "Email", key: "email", width: 30 },
    { header: "Address", key: "address", width: 35 },
    { header: "Phone", key: "phoneNumber", width: 22 },
    { header: "Position", key: "position", width: 30 },
    { header: "Role", key: "role", width: 15 },
    { header: "Department", key: "department", width: 20 },
    { header: "Status", key: "status", width: 10 },
    { header: "Join Date", key: "joinDate", width: 15 },
  ];

  users.forEach((user) => {
    sheet.addRow({
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      address: user.address,
      phoneNumber: user.phoneNumber,
      position: user.position,
      role: user.role_id?.name,
      department: user.department_id?.name,
      status: user.status,
      joinDate: user.joinDate
        ? new Date(user.joinDate).toLocaleDateString("en-GB")
        : "",
    });
  });

  // Header style
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "89D2DC" },
    };
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Data borders
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  // HTTP response (res) handled in service (streaming requirement)
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", "attachment; filename=users.xlsx");

  await workbook.xlsx.write(res);
  res.end();
};

// Upload a profile image
export const uploadProfileImageService = async (
  userId,
  file,
  currentUser,
  ip,
) => {
  // Check user existence
  const existingUser = await User.findById(userId);
  if (!existingUser) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Check if a file is uploaded
  if (!file) {
    throw new AppError(
      commonErrors.NO_FILE_UPLOADED.message,
      commonErrors.NO_FILE_UPLOADED.code,
      commonErrors.NO_FILE_UPLOADED.errorCode,
      commonErrors.NO_FILE_UPLOADED.suggestion,
    );
  }

  // Delete old image if exists (To replace it with the new one)
  if (existingUser.profileImagePublicId) {
    await deleteFromCloudinary(existingUser.profileImagePublicId, "image");
  }

  // Upload the new image
  const result = await uploadImageToCloudinary(
    file.buffer,
    "hrcom/profile_images",
  );

  // Update the user
  const user = await User.findByIdAndUpdate(
    userId,
    {
      profileImageURL: result.secure_url,
      profileImagePublicId: result.public_id,
    },
    { returnDocument: "after" },
  );

  // Notify the user only if an admin modified someone else's profile
  if (
    currentUser.role === "Admin" &&
    currentUser.id.toString() !== user._id.toString()
  ) {
    try {
      await createNotification({
        recipientId: user._id,
        type: "ACCOUNT",
        title: "Profile Picture Updated",
        message: "Your profile picture has been updated by HR.",
        data: {
          entityType: "USER",
          entityId: user._id,
        },
      });
    } catch (err) {
      console.log("Profile picture update notification failed:", err.message);
    }
  }

  // Audit log
  await logAuditAction({
    adminId: currentUser.id,
    action: "UPLOAD_IMAGE",
    targetType: "User",
    targetId: user._id,
    targetName: `${user.name} ${user.lastName}`,
    details: {
      profileImageURL: result.secure_url,
      profileImagePublicId: result.public_id,
    },
    ipAddress: ip,
  });

  return {
    status: "Success",
    code: 200,
    message: "Profile Image uploaded successfully!",
    data: await User.findById(userId).select(SENSITIVE_FIELDS),
  };
};

// Remove a profile image
export const removeProfileImageService = async (userId, currentUser, ip) => {
  // Check user existence
  const existingUser = await User.findById(userId);
  if (!existingUser) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Delete image from Cloudinary if exists
  if (existingUser.profileImagePublicId) {
    await deleteFromCloudinary(existingUser.profileImagePublicId);
  }

  // Update the user
  const user = await User.findByIdAndUpdate(
    userId,
    {
      profileImageURL: "",
      profileImagePublicId: "",
    },
    { returnDocument: "after" },
  );

  // Notify the user only if an admin modified someone else's profile
  if (
    currentUser.role === "Admin" &&
    currentUser.id.toString() !== user._id.toString()
  ) {
    try {
      await createNotification({
        recipientId: user._id,
        type: "ACCOUNT",
        title: "Profile Picture Removed",
        message: "Your profile picture has been removed by HR.",
        data: {
          entityType: "USER",
          entityId: user._id,
        },
      });
    } catch (err) {
      console.log("Profile picture removal notification failed:", err.message);
    }
  }

  // Audit log
  await logAuditAction({
    adminId: currentUser.id,
    action: "REMOVE_IMAGE",
    targetType: "User",
    targetId: user._id,
    targetName: `${user.name} ${user.lastName}`,
    ipAddress: ip,
  });

  return {
    status: "Success",
    code: 200,
    message: "Profile Image removed successfully!",
    data: await User.findById(userId).select(SENSITIVE_FIELDS),
  };
};

// Enroll the face descriptors for face recognition (Custom not generic)
export const enrollFaceService = async (userId, descriptors) => {
  if (!descriptors || !Array.isArray(descriptors) || descriptors.length === 0) {
    throw new AppError(
      errors.MISSING_FACE_DESCRIPTORS.message,
      errors.MISSING_FACE_DESCRIPTORS.code,
      errors.MISSING_FACE_DESCRIPTORS.errorCode,
      errors.MISSING_FACE_DESCRIPTORS.suggestion,
    );
  }

  const result = await User.updateOne(
    { _id: userId },
    {
      $set: {
        faceDescriptors: descriptors,
        faceEnrolled: true,
        faceEnrollmentPromptRequired: false,
      },
    },
  );

  if (result.matchedCount === 0) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Face Id enrolled successfully!",
  };
};

// Reset the face descriptors (Custom not generic)
export const resetFaceService = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  user.faceDescriptors = [];
  user.faceEnrolled = false;
  user.faceEnrollmentPromptRequired = true;

  await user.save();

  return {
    status: "Success",
    code: 200,
    message: "Face Id reset successfully!",
  };
};
