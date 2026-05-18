import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { errors } from "../errors/middlewareTokenErrors.js";
import AppError from "../utils/AppError.js";

dotenv.config();

// Middleware to authenticate users based on JWT token
const authenticate = (req, res, next) => {
  const token =
    (req.headers["authorization"]?.startsWith("Bearer ")
      ? req.headers["authorization"].split(" ")[1]
      : null) ?? req.query.token ?? null;

  if (!token) {
    return next(
      new AppError(
        errors.NO_TOKEN_PROVIDED.message,
        errors.NO_TOKEN_PROVIDED.code,
        errors.NO_TOKEN_PROVIDED.errorCode,
        errors.NO_TOKEN_PROVIDED.suggestion,
      ),
    );
  }

  try {
    // Decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    next();
  } catch (err) {
    return next(
      new AppError(
        errors.INVALID_OR_EXPIRED_TOKEN.message,
        errors.INVALID_OR_EXPIRED_TOKEN.code,
        errors.INVALID_OR_EXPIRED_TOKEN.errorCode,
        errors.INVALID_OR_EXPIRED_TOKEN.suggestion,
      ),
    );
  }
};

export default authenticate;
