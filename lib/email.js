export const sendPasswordResetOTPEmail = async (email, otp) => {
  try {
    let authConfig = {};
    if (process.env.EMAIL_HOST && process.env.EMAIL_HOST.includes("gmail")) {
      authConfig = {
        user: process.env.ETHEREAL_EMAIL || process.env.EMAIL_USER,
        pass: process.env.ETHEREAL_PASSWORD || process.env.EMAIL_PASS,
      };
    } else {
      authConfig = {
        user: process.env.ETHEREAL_EMAIL,
        pass: process.env.ETHEREAL_PASSWORD,
      };
    }
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.ethereal.email",
      port: parseInt(process.env.EMAIL_PORT || "587"),
      secure: process.env.EMAIL_PORT === "465",
      auth: authConfig,
    });
    const mailOptions = {
      from: process.env.EMAIL_FROM || authConfig.user,
      to: email,
      subject: "Password Reset OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f4f4f4; border-radius: 8px;">
          <h2 style="color: #10b981; text-align: center;">Password Reset OTP</h2>
          <p style="font-size: 16px; color: #333;">
            Your password reset code is:
          </p>
          <h3 style="text-align: center; font-size: 24px; color: #333; background-color: #e0f2fe; padding: 10px; border-radius: 5px;">
            ${otp}
          </h3>
          <p style="font-size: 16px; color: #333;">
            This code is valid for 10 minutes. If you did not request this, please ignore this email.
          </p>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
export const sendPasswordResetEmail = async (email, resetLink) => {
  try {
    let authConfig = {};
    if (process.env.EMAIL_HOST && process.env.EMAIL_HOST.includes("gmail")) {
      authConfig = {
        user: process.env.ETHEREAL_EMAIL || process.env.EMAIL_USER,
        pass: process.env.ETHEREAL_PASSWORD || process.env.EMAIL_PASS,
      };
    } else {
      authConfig = {
        user: process.env.ETHEREAL_EMAIL,
        pass: process.env.ETHEREAL_PASSWORD,
      };
    }
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.ethereal.email",
      port: parseInt(process.env.EMAIL_PORT || "587"),
      secure: process.env.EMAIL_PORT === "465",
      auth: authConfig,
    });
    const mailOptions = {
      from: process.env.EMAIL_FROM || authConfig.user,
      to: email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f4f4f4; border-radius: 8px;">
          <h2 style="color: #10b981; text-align: center;">Password Reset</h2>
          <p style="font-size: 16px; color: #333;">
            You requested a password reset. Click the link below to set a new password. This link is valid for 1 hour.
          </p>
          <a href="${resetLink}" style="display: block; text-align: center; margin: 20px 0; padding: 10px 20px; background: #10b981; color: #fff; border-radius: 5px; text-decoration: none;">Reset Password</a>
          <p style="font-size: 14px; color: #666; text-align: center;">
            If you did not request this, you can ignore this email.
          </p>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
// File: backend/lib/email.js
// Instructions: If `lib/email.js` exists, replace it with this content. If not, create it in `backend/lib/`.

import nodemailer from "nodemailer";

export const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

export const sendVerificationEmail = async (email, code) => {
  try {
    // Choose credentials based on EMAIL_HOST
    let authConfig = {};
    if (process.env.EMAIL_HOST && process.env.EMAIL_HOST.includes("gmail")) {
      authConfig = {
        user: process.env.ETHEREAL_EMAIL || process.env.EMAIL_USER,
        pass: process.env.ETHEREAL_PASSWORD || process.env.EMAIL_PASS,
      };
    } else {
      authConfig = {
        user: process.env.ETHEREAL_EMAIL,
        pass: process.env.ETHEREAL_PASSWORD,
      };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.ethereal.email",
      port: parseInt(process.env.EMAIL_PORT || "587"),
      secure: process.env.EMAIL_PORT === "465",
      auth: authConfig,
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || authConfig.user,
      to: email,
      subject: "Verify Your Email - Your OTP Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f4f4f4; border-radius: 8px;">
          <h2 style="color: #10b981; text-align: center;">Email Verification</h2>
          <p style="font-size: 16px; color: #333;">
            Thank you for signing up! Please use the following One-Time Password (OTP) to verify your email address:
          </p>
          <h3 style="text-align: center; font-size: 24px; color: #333; background-color: #e0f2fe; padding: 10px; border-radius: 5px;">
            ${code}
          </h3>
          <p style="font-size: 16px; color: #333;">
            This OTP is valid for 10 minutes. If you did not request this, please ignore this email.
          </p>
          <p style="font-size: 14px; color: #666; text-align: center;">
            &copy; ${new Date().getFullYear()} Your App. All rights reserved.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Verification email sent:", info.messageId);
    return { success: true };
  } catch (error) {
    console.error("Error sending verification email:", error.message);
    return { success: false, error: error.message };
  }
};