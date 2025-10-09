import express from "express";
import { protectRoute, strictAdminOnly } from "../middleware/auth.middleware.js";
import { getAllUsers, deleteUser, updateUserRole } from "../controllers/user.controller.js";

const router = express.Router();


router.get("/all", protectRoute, strictAdminOnly, getAllUsers);
router.delete("/:userId", protectRoute, strictAdminOnly, deleteUser);
router.patch("/:userId/role", protectRoute, strictAdminOnly, updateUserRole);

export default router;

