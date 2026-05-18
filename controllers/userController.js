import * as userService from "../services/userService.js";
import * as supervisorService from "../services/supervisorService.js";
import * as internService from "../services/internService.js";
import { transformUserFilters } from "../utils/userQueryTransformer.js";
import { resolveRoleId } from "../utils/userResolvers.js";


// Get User by ID
export const getUserById = async (req, res, next) => {
  try {
    let { id } = req.params;
    if (id === "current") {
      id = req.user?.id;
    }

    /* 
      Check if the requester is trying to access their own data or is it another user 
      (For ex: An admin or the user's supervisor accessing a user's profile data)
    */
    const requesterId = req.user?.id || req.user?._id;
    const result = await userService.getUser(id);

    // Robust self-check: compare the requester's ID from the token 
    // against the database ID of the user we just found.
    const dbUserId = result.data?._id?.toString() || result.data?.id?.toString();
    const currentUserId = requesterId?.toString();
    
    const isSelf = currentUserId && dbUserId && currentUserId === dbUserId;

    // If not requester = user, we remove the faceDescriptors for privacy
    if (!isSelf) {
      if (result.data) result.data.faceDescriptors = undefined;
    }

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all Users (Admin only)
export const getAllUsers = async (req, res, next) => {
  try {
    const { id: userId, role } = req.user;

    // Default filters: prevent user from seeing themselves in the list
    req.query._id = { ne: userId };

    // If the requester is a Supervisor, restrict results to their team only
    if (role === "Supervisor") {
      req.query.supervisorId = userId;
      
      // Also exclude other Supervisors from the list
      const supervisorRoleId = await resolveRoleId("Supervisor");
      req.query.role_id = { ne: supervisorRoleId };
    }

    console.log("USER FETCH DEBUG - Original Query:", req.query);

    // Map the query parameters (For ex: role -> role_id and department -> department_id)
    const queryParams = await transformUserFilters(req.query);
    
    console.log("USER FETCH DEBUG - Transformed Query:", queryParams);

    const result = await userService.getUsers(queryParams);
    
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get available active supervisors (Admin only)
export const getActiveSupervisorsController = async (req, res, next) => {
  try {
    const result = await supervisorService.getActiveSupervisors(req.query);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get the 3 recent supervisors (For the dropdown in the Create/Edit user form)
export const getRecentSupervisorsController = async (req, res, next) => {
  try {
    const result = await supervisorService.getRecentSupervisors(req.query);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Public: Get active interns for marketing site (no auth)
export const getPublicInterns = async (req, res, next) => {
  try {
    const result = await internService.getPublic();
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Add a new user (Admin only)
export const addUser = async (req, res, next) => {
  try {
    const result = await userService.addUserService(req.body, req.user, req.ip);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Update a user (Admin only)
export const updateUser = async (req, res, next) => {
  try {
    let { id } = req.params;
    if (id === "current") id = req.user.id;

    const result = await userService.updateUserService(id, req.body, req.user, req.ip);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Delete User (Admin only)
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await userService.deleteUserService(id, req.user, req.ip);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Toggle User Status(Active/Inactive) (Only for Admins)
export const toggleUserStatus = async (req, res, next) => {
  try {
    const result = await userService.toggleUserStatusService(req.params.id, req.user, req.ip);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Export User to CSV format (Only for Admins)
export const exportUsersToCSV = async (req, res, next) => {
  try {
    const csv = await userService.exportUsersToCSVService(req.query);

    res.header("Content-Type", "text/csv");
    res.attachment("users.csv");
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

// Export User to Excel format (Only for Admins)
export const exportUsersToExcel = async (req, res, next) => {
  try {
    await userService.exportUsersToExcelService(req.query, res); // Pass the res to the service to handle the stream
  } catch (err) {
    next(err);
  }
};

// Upload Profile Image
export const uploadProfileImage = async (req, res, next) => {
  try {
    const result = await userService.uploadProfileImageService(
      req.params.id,
      req.file,
      req.user,
      req.ip
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Remove Profile Image
export const removeProfileImage = async (req, res, next) => {
  try {
    const result = await userService.removeProfileImageService(
      req.params.id,
      req.user,
      req.ip
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Face Enrollment functionality
export const enrollFace = async (req, res, next) => {
  try {
    const result = await userService.enrollFaceService(
      req.params.id,
      req.body.descriptors
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Face reset functionality
export const resetFace = async (req, res, next) => {
  try {
    const result = await userService.resetFaceService(req.params.id);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
