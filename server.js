import cloudinaryConfigRoute from "./routes/cloudinary.route.js";
import dotenv from "dotenv";
// Load environment variables
dotenv.config();

import express from "express";
import cookieParser from "cookie-parser";
import path from "path";

import { fileURLToPath } from "url";
import cors from "cors";

import authRoutes from "./routes/auth.route.js";
import productRoutes from "./routes/product.route.js";
import cartRoutes from "./routes/cart.route.js";
import couponRoutes from "./routes/coupon.route.js";
import paymentRoutes from "./routes/payment.route.js";


import analyticsRoutes from "./routes/analytics.route.js";
import sellerRoutes from "./routes/seller.route.js";
import escrowRoutes from "./routes/escrow.route.js";

import { connectDB } from "./lib/db.js";
import { redis } from "./lib/redis.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  cors({
    origin: [
      process.env.CLIENT_URL,
      "https://fyp-frontend-yls3.onrender.com",
      "http://localhost:5173"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);



// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// API routes
app.use("/api/config", cloudinaryConfigRoute);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/payments", paymentRoutes);


app.use("/api/analytics", analyticsRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/escrow", escrowRoutes);

// Serve frontend (only in production)
if (process.env.NODE_ENV === "production") {
  const staticPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(staticPath));
  app.get("*", (req, res) => {
    const indexPath = path.resolve(staticPath, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) res.status(500).send("Error serving index.html");
    });
  });
} else {
  app.get("/", (req, res) => {
    res.send("Server is running");
  });
}

// DB + Server Init
connectDB();
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
