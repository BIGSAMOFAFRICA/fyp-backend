// File: backend/controllers/verification.js
// Instructions: Create this new file in the `backend/controllers/` directory.

import User from "../models/user.model.js";
import { generateVerificationCode, sendVerificationEmail } from "../lib/email.js";

// Generate and send OTP to user's email
export const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Generate new OTP and expiration
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with new OTP
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = verificationCodeExpires;
    await user.save();

    // Send verification email
    const emailResult = await sendVerificationEmail(email, verificationCode);
    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error);
      return res.status(500).json({ message: "Failed to send OTP" });
    }

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error in sendOTP:", error.message);
    res.status(500).json({ message: "Server error during OTP generation" });
  }
};

// Verify OTP submitted by user
export const verifyOTP = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Find user by email and OTP
    const user = await User.findOne({
      email,
      verificationCode: code,
      verificationCodeExpires: { $gt: new Date() }, // Ensure OTP is not expired
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Mark user as verified
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Email verified successfully", isVerified: true });
  } catch (error) {
    console.error("Error in verifyOTP:", error.message);
    res.status(500).json({ message: "Server error during OTP verification" });
  }
};