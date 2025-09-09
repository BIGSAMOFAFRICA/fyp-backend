import Notification from "../models/notification.model.js";

// Get notifications for a user
export const getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Mark notification as read
export const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    if (!notification.user.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });
    notification.read = true;
    await notification.save();
    res.json({ notification });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin: send notification to a user (e.g., on product approval/rejection)
export const sendNotification = async (req, res) => {
  try {
    const { userId, type, message, meta } = req.body;
    const notification = await Notification.create({
      user: userId,
      type,
      message,
      meta: meta || {},
    });
    res.status(201).json({ notification });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
