// Checks if user is admin by role
export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Access denied - Admin only" });
};
// File: backend/middleware/auth.middleware.js
// Instructions: Replace the existing `auth.middleware.js` in `backend/middleware/` with this content.

import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protectRoute = async (req, res, next) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }
  if (!token) {
    return res.status(401).json({ message: "Unauthorized - No access token provided" });
  }
  try {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (jwtError) {
      console.error("JWT verification failed in auth middleware:", jwtError.message);
      return res.status(401).json({ message: "Unauthorized - Invalid access token" });
    }

    let user;
    try {
      user = await User.findById(decoded.userId).select("-password");
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
    } catch (dbError) {
      console.error("Database error in auth middleware:", dbError.message);
      return res.status(500).json({ message: "Server error when authenticating user" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Email not verified" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Unexpected error in auth middleware:", error.message);
    return res.status(500).json({ message: "Server error during authentication" });
  }
};

export const adminRoute = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({ message: "Access denied - Admin only" });
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (req.user && roles.includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ message: `Access denied - ${roles.join(" or ")} only` });
};

export const strictAdminOnly = (req, res, next) => {
  if (req.user && req.user.email === "olabisisamuelayomide@gmail.com") {
    return next();
  }
  return res.status(403).json({ message: "Access denied - Strict admin only" });
};