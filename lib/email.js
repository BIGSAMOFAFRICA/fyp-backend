import axios from "axios";
import nodemailer from "nodemailer";

// Helper to generate a 6-digit numeric verification/OTP code
export const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
// Helper for Brevo (Sendinblue) API
const brevoSendEmail = async ({ to, subject, html }) => {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_FROM_EMAIL) {
    console.error("Brevo email API key or sender missing");
    return { success: false, error: "Missing BREVO_API_KEY/BREVO_FROM_EMAIL" };
  }
  try {
    const res = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { email: process.env.BREVO_FROM_EMAIL, name: "Your App" },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json"
        },
        timeout: 10000 // do not hang for slow API
      }
    );
    if (res.status >= 200 && res.status < 300) return { success: true };
    return { success: false, error: res.statusText };
  } catch (error) {
    console.error("[BREVO ERROR]", error.response ? error.response.data : error.message);
    return { success: false, error: error.message };
  }
};

// NOTE: OTP-based emails removed. Use sendPasswordResetEmail (link-based) instead.
// Send notification to seller when payment is received
export const sendPaymentReceivedNotification = async (sellerEmail, sellerName, buyerName, productName, amount) => {
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
      to: sellerEmail,
      subject: "💰 New Sale - Payment Received in Escrow",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f4f4f4; border-radius: 8px;">
          <h2 style="color: #10b981; text-align: center;">🎉 New Sale Notification</h2>
          <p style="font-size: 16px; color: #333;">
            Hello ${sellerName},
          </p>
          <p style="font-size: 16px; color: #333;">
            Great news! Your product has been sold and payment has been received.
          </p>
          
          <div style="background-color: #e0f2fe; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #0369a1; margin-top: 0;">Sale Details:</h3>
            <p><strong>Product:</strong> ${productName}</p>
            <p><strong>Buyer:</strong> ${buyerName}</p>
            <p><strong>Amount:</strong> ₦${amount.toLocaleString()}</p>
            <p><strong>Status:</strong> Payment in Escrow (Awaiting Admin Approval)</p>
          </div>
          
          <p style="font-size: 16px; color: #333;">
            Your payment is securely held in escrow until the admin approves the transaction. 
            You will receive 85% of the sale amount once approved.
          </p>
          
          <p style="font-size: 14px; color: #666; text-align: center;">
            &copy; ${new Date().getFullYear()} Your Marketplace. All rights reserved.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending payment notification:", error);
    return { success: false, error: error.message };
  }
};

// Send notification to seller when payment is released
export const sendPaymentReleasedNotification = async (sellerEmail, sellerName, buyerName, productName, amount, sellerShare) => {
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
      to: sellerEmail,
      subject: "✅ Payment Released - Funds Transferred to Your Account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f4f4f4; border-radius: 8px;">
          <h2 style="color: #10b981; text-align: center;">🎉 Payment Released!</h2>
          <p style="font-size: 16px; color: #333;">
            Hello ${sellerName},
          </p>
          <p style="font-size: 16px; color: #333;">
            Excellent news! Your escrow payment has been approved and released.
          </p>
          
          <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #166534; margin-top: 0;">Payment Details:</h3>
            <p><strong>Product:</strong> ${productName}</p>
            <p><strong>Buyer:</strong> ${buyerName}</p>
            <p><strong>Total Sale:</strong> ₦${amount.toLocaleString()}</p>
            <p><strong>Your Share (85%):</strong> ₦${sellerShare.toLocaleString()}</p>
            <p><strong>Status:</strong> ✅ Released to Your Account</p>
          </div>
          
          <p style="font-size: 16px; color: #333;">
            The funds have been transferred to your account via Paystack. 
            You can now withdraw or use these funds as needed.
          </p>
          
          <p style="font-size: 14px; color: #666; text-align: center;">
            &copy; ${new Date().getFullYear()} Your Marketplace. All rights reserved.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending release notification:", error);
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

  export const sendPasswordResetOTPEmail = async (email, otp) => {
    const subject = "Password Reset OTP";
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background-color:#f4f4f4;border-radius:8px;">
        <h2 style="color:#10b981;text-align:center;">Password Reset</h2>
        <p style="font-size:16px;color:#333;">Use the following One-Time Password (OTP) to reset your password:</p>
        <h3 style="text-align:center;font-size:24px;color:#333;background-color:#e0f2fe;padding:10px;border-radius:5px;">${otp}</h3>
        <p style="font-size:16px;color:#333;">This OTP is valid for 10 minutes. If you did not request this, please ignore this email.</p>
        <p style="font-size:14px;color:#666;text-align:center;">&copy;${new Date().getFullYear()} Your App. All rights reserved.</p>
      </div>`;
    return await brevoSendEmail({ to: email, subject, html });
  };

  // verification email removed — signup no longer sends OTPs for verification