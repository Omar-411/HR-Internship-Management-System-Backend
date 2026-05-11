import User from "../models/User.js";
import { errors } from "../errors/middlewareTokenErrors.js";
import AppError from "../utils/AppError.js";
import { resolveId } from "../utils/idResolver.js";

// Middleware to authorize users based on role, self-access, or supervisor access
const authorize = (roles = [], options = {}) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      // Check the Role Permission
      const allowedRoles = Array.isArray(roles) ? roles : [roles];
      const userRole = (user.role || "").toString().trim().toLowerCase();
      
      console.log(`[AUTH-DEBUG] Path: ${req.originalUrl}, UserRole: "${user.role}", Normalized: "${userRole}", Allowed: ${JSON.stringify(allowedRoles)}`);

      if (allowedRoles.some(r => r.trim().toLowerCase() === userRole)) {
        return next();
      }

      // Determine the target ID (fallback to req.params.id or req.params.userId if not explicitly set by previous middleware)
      const targetId = req.targetUserId || req.params.id || req.params.userId;

      // Check if the user himself has self access
      let targetUser = null;

      if (options.allowSelf) {
        const tokenUserId = (user.id || user._id || "").toString();
        
        // Use either targetUserId overlay or the id from params
        const finalTargetId = (targetId || "").toString();

        console.log(`[AUTH-DEBUG] TokenUserID: ${tokenUserId}, TargetID: ${finalTargetId}, Match: ${tokenUserId === finalTargetId}`);

        if (finalTargetId === "current" || tokenUserId === finalTargetId) {
          return next();
        }

        if (finalTargetId && finalTargetId !== "current") {
          targetUser = await User.findOne(resolveId(finalTargetId));
          if (targetUser && tokenUserId === targetUser._id.toString()) {
            return next();
          }
        }
      }

      // Check if the supervisor has access
      if (options.allowSupervisor) {
        if (!targetUser && targetId && targetId !== "current") {
          targetUser = await User.findOne(resolveId(targetId));
        }

        if (targetUser && user.id === targetUser.supervisor_id?.toString()) {
          return next();
        }
      }

      return next(
        new AppError(
          errors.UNAUTHORIZED.message,
          errors.UNAUTHORIZED.code,
          errors.UNAUTHORIZED.errorCode,
          errors.UNAUTHORIZED.suggestion
        )
      );
    } catch (err) {
      return next(
        new AppError(
          errors.SERVER_ERROR.message,
          errors.SERVER_ERROR.code,
          errors.SERVER_ERROR.errorCode,
          errors.SERVER_ERROR.suggestion
        )
      );
    }
  };
};

export default authorize;
