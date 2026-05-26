import * as authService from "../services/authService.js";
import dotenv from "dotenv";
dotenv.config();

// Login Functionality
export const login = async (req, res, next) => {
  try {
    const result = await authService.loginService(req.body);
    
    if (result.type === "OTP_REQUIRED") {
      return res.status(200).json({
        status: "Success but OTPVerificationRequired",
        message: "OTP verification is required to complete the login process",
        code : 200
      });
    }

    if (result.type === "RESET_PASSWORD_REQUIRED") {
      return res.status(200).json({
        status: "Success but MustResetPassword",
        message: "Password reset is required to complete the login process",
        code: 200
      });
    }

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Verify User's OTP code
export const verifyUser = async (req, res, next) => {
  try {
    const result = await authService.verifyUserService(req.body);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Resend OTP Code
export const resendVerificationCode = async (req, res, next) => {
  try {
    const result = await authService.resendVerificationCodeService(req.body);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Reset Password
export const resetPassword = async (req, res, next) => {
  try {
    const result = await authService.resetPasswordService(req.body);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Forget Password Request
export const requestPasswordReset = async (req, res, next) => {
  try {
    const result = await authService.requestPasswordResetService(req.body);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Forget Password Reset
export const forgetPassword = async (req, res, next) => {
  try {
    const result = await authService.forgetPasswordService(req.body);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
