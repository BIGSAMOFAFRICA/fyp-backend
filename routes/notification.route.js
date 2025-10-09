import express from "express";
import { getUserNotifications, markNotificationRead, sendNotification } from "../controllers/notification.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();


router.get("/", protectRoute, getUserNotifications);

router.patch("/:id/read", protectRoute, markNotificationRead);

router.post("/send", protectRoute, sendNotification);

export default router;
