export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Access denied - Admin only" });
};
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

import { redis } from "../lib/redis.js";

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
    let user;
    
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (jwtError) {
      console.error("JWT verification failed:", jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        try {
          const refreshToken = req.cookies.refreshToken;
          if (!refreshToken) {
            return res.status(401).json({ message: "Access token expired and no refresh token provided" });
          }
          
          const refreshDecoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
          
          let storedToken;
          try {
            storedToken = await redis.get(`refresh_token:${refreshDecoded.userId}`);
          } catch (redisError) {
            console.error("Redis error when fetching refresh token in middleware:", redisError.message);
            // Continue with token validation even if Redis fails
          }
          
          if (storedToken && storedToken !== refreshToken) {
            return res.status(401).json({ message: "Invalid refresh token" });
          }
          
          const newAccessToken = jwt.sign({ userId: refreshDecoded.userId }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "15m",
          });
          
          res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 15 * 60 * 1000,
          });
          
          decoded = jwt.verify(newAccessToken, process.env.ACCESS_TOKEN_SECRET);
          
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError.message);
          return res.status(401).json({ message: "Token expired and refresh failed" });
        }
      } else {
        return res.status(401).json({ message: "Unauthorized - Invalid access token" });
      }
    }

    try {
      user = await User.findById(decoded.userId).select("-password");
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
    } catch (dbError) {
      console.error("Database error in auth middleware:", dbError.message);
      return res.status(500).json({ message: "Server error when authenticating user" });
    }

    // Previously the system required email verification before allowing access.
    // OTP-based signup verification was removed, so we no longer block users here.
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