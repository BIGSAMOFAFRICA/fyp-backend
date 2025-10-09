import express from "express";
import { 
  createIssue, 
  getBuyerIssues, 
  getIssue, 
  addIssueMessage, 
  getAllIssues, 
  updateIssueStatus, 
  assignIssue 
} from "../controllers/issue.controller.js";
import { protectRoute, requireRole, strictAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();


router.post("/", protectRoute, requireRole(["buyer"]), createIssue);
router.get("/buyer", protectRoute, requireRole(["buyer"]), getBuyerIssues);
router.get("/:issueId", protectRoute, getIssue);
router.post("/:issueId/message", protectRoute, addIssueMessage);


router.get("/admin/all", protectRoute, strictAdminOnly, getAllIssues);
router.patch("/:issueId/status", protectRoute, strictAdminOnly, updateIssueStatus);
router.patch("/:issueId/assign", protectRoute, strictAdminOnly, assignIssue);

export default router;

