import express from "express";
import { getUserNotifications, markNotificationRead, sendNotification } from "../controllers/notification.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// Get notifications for logged-in user
router.get("/", protectRoute, getUserNotifications);
// Mark notification as read
router.patch("/:id/read", protectRoute, markNotificationRead);
// Admin: send notification to a user
router.post("/send", protectRoute, sendNotification);

export default router;
