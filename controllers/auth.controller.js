// File: backend/controllers/auth.controller.js
// Instructions: Replace the existing `auth.controller.js` in `backend/controllers/` with this content.

import { redis } from "../lib/redis.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { generateVerificationCode, sendVerificationEmail } from "../lib/email.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail, sendPasswordResetOTPEmail } from "../lib/email.js";

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });

  const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
};

const storeRefreshToken = async (userId, refreshToken) => {
  try {
    const setPromise = redis.set(`refresh_token:${userId}`, refreshToken, "EX", 7 * 24 * 60 * 60);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Redis operation timed out")), 1000)
    );
    await Promise.race([setPromise, timeoutPromise]);
    console.log(`✅ Successfully stored refresh token for user ${userId}`);
  } catch (error) {
    console.error("Failed to store refresh token in Redis:", error.message);
    console.log("⚠️ Continuing without storing refresh token in Redis");
  }
};

const setCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const signup = async (req, res) => {
  const { email, password, name, role } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    let userRole = "buyer";
    if (role === "seller") userRole = "seller";


    // Normal user flow
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
      verificationCode,
      verificationCodeExpires,
      isVerified: false,
    });

    const emailResult = await sendVerificationEmail(email, verificationCode);
    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error);
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    await storeRefreshToken(user._id, refreshToken);
    setCookies(res, accessToken, refreshToken);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      accessToken,
      message: "Please check your email for OTP",
    });
  } catch (error) {
    console.error("Error in signup controller:", error.message);
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {

      // Normal user: block if not verified
      if (!user.isVerified) {
        if (!user.verificationCodeExpires || user.verificationCodeExpires < new Date()) {
          const verificationCode = generateVerificationCode();
          const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
          user.verificationCode = verificationCode;
          user.verificationCodeExpires = verificationCodeExpires;
          await user.save();
          await sendVerificationEmail(email, verificationCode);
        }
        return res.status(403).json({
          message: "Email not verified",
          isVerified: false,
          _id: user._id,
          email: user.email,
        });
      }

      const { accessToken, refreshToken } = generateTokens(user._id);
      await storeRefreshToken(user._id, refreshToken);
      setCookies(res, accessToken, refreshToken);

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        accessToken,
      });
    } else {
      res.status(400).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.error("Error in login controller:", error.message);
    res.status(500).json({ message: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const deletePromise = redis.del(`refresh_token:${decoded.userId}`);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Redis operation timed out")), 1000)
        );
        await Promise.race([deletePromise, timeoutPromise]);
        console.log(`✅ Successfully deleted refresh token for user ${decoded.userId}`);
      } catch (redisError) {
        console.error("Failed to delete refresh token from Redis:", redisError.message);
      }
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logout controller:", error.message);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.status(500).json({ message: "Server error during logout, but cookies cleared" });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (jwtError) {
      console.error("JWT verification failed:", jwtError.message);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    let storedToken;
    try {
      const getPromise = redis.get(`refresh_token:${decoded.userId}`);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis operation timed out")), 1000)
      );
      storedToken = await Promise.race([getPromise, timeoutPromise]);
    } catch (redisError) {
      console.error("Redis error when fetching refresh token:", redisError.message);
      console.log("Proceeding with token refresh despite Redis error");
    }

    if (storedToken && storedToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const accessToken = jwt.sign({ userId: decoded.userId }, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "15m",
    });

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    res.json({
      message: "Token refreshed successfully",
      accessToken,
    });
  } catch (error) {
    console.error("Error in refreshToken controller:", error.message);
    res.status(500).json({ message: "Server error during token refresh" });
  }
};

export const getProfile = async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    console.error("Error in getProfile controller:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
// Verify OTP validity (for password reset)
export const verifyPasswordResetOTP = async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({
    email,
    resetPasswordOTP: otp,
    resetPasswordOTPExpires: { $gt: Date.now() },
  });
  if (!user) {
    return res.status(400).json({ valid: false, message: "Invalid or expired OTP." });
  }
  res.json({ valid: true, message: "OTP is valid." });
};

// Request password reset (OTP version)
export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(200).json({ message: "If that email exists, an OTP was sent." });

  const otp = generateVerificationCode();
  user.resetPasswordOTP = otp;
  user.resetPasswordOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save();

  await sendPasswordResetOTPEmail(email, otp);

  res.json({ message: "If that email exists, an OTP was sent." });
};

// Reset password with OTP
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    const user = await User.findOne({
      email,
      resetPasswordOTP: otp,
      resetPasswordOTPExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }
  user.password = password; // Let pre-save hook hash it
  user.isVerified = true; // Mark user as verified after password reset
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    await user.save();
    return res.json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    console.error("Error in resetPassword:", error.message);
    return res.status(500).json({ message: "Server error. Please try again later." });
  }
};