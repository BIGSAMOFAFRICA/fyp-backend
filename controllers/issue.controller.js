import Issue from "../models/issue.model.js";
import EscrowTransaction from "../models/escrowTransaction.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";


export const createIssue = async (req, res) => {
  try {
    const { title, description, category, priority, relatedOrderId, relatedProductId } = req.body;
    const reportedBy = req.user._id;

    
    let relatedOrder = null;
    let relatedProduct = null;
    let relatedSeller = null;

    if (relatedOrderId) {
      relatedOrder = await EscrowTransaction.findById(relatedOrderId);
      if (!relatedOrder) {
        return res.status(404).json({ message: "Related order not found" });
      }
      
      if (String(relatedOrder.buyerId) !== String(reportedBy)) {
        return res.status(403).json({ message: "You can only report issues for your own orders" });
      }
      relatedProduct = relatedOrder.productId;
      relatedSeller = relatedOrder.sellerId;
    }

    if (relatedProductId) {
      relatedProduct = await Product.findById(relatedProductId);
      if (!relatedProduct) {
        return res.status(404).json({ message: "Related product not found" });
      }
    }

    
    const issue = new Issue({
      title,
      description,
      category,
      priority,
      reportedBy,
      relatedOrder: relatedOrderId || null,
      relatedProduct: relatedProductId || (relatedProduct ? relatedProduct._id : null),
      relatedSeller: relatedSeller || null
    });

    await issue.save();

    
    await issue.populate([
      { path: 'reportedBy', select: 'name email' },
      { path: 'relatedOrder', select: 'paystackReference totalAmount' },
      { path: 'relatedProduct', select: 'name price' },
      { path: 'relatedSeller', select: 'name email' }
    ]);

    
    try {
      await Notification.create({
        user: null, 
        type: "admin_message",
        message: `New issue reported: ${title} - Category: ${category}`,
        meta: {
          issueId: issue._id,
          reportedBy: issue.reportedBy.name,
          category: category,
          priority: priority
        }
      });
    } catch (notificationError) {
      console.error("Error creating admin notification:", notificationError);
    }

    res.status(201).json({
      message: "Issue reported successfully",
      issue
    });
  } catch (error) {
    console.error("Error creating issue:", error);
    res.status(500).json({ message: "Error creating issue", error: error.message });
  }
};


export const getBuyerIssues = async (req, res) => {
  try {
    const buyerId = req.user._id;
    
    const issues = await Issue.find({ reportedBy: buyerId })
      .populate('relatedOrder', 'paystackReference totalAmount status')
      .populate('relatedProduct', 'name price')
      .populate('relatedSeller', 'name email')
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      message: "Issues retrieved successfully",
      issues
    });
  } catch (error) {
    console.error("Error fetching buyer issues:", error);
    res.status(500).json({ message: "Error fetching issues", error: error.message });
  }
};


export const getIssue = async (req, res) => {
  try {
    const { issueId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const issue = await Issue.findById(issueId)
      .populate('reportedBy', 'name email')
      .populate('relatedOrder', 'paystackReference totalAmount status')
      .populate('relatedProduct', 'name price')
      .populate('relatedSeller', 'name email')
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .populate('messages.sender', 'name email role');

    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    
    if (userRole !== 'admin' && String(issue.reportedBy._id) !== String(userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({
      message: "Issue retrieved successfully",
      issue
    });
  } catch (error) {
    console.error("Error fetching issue:", error);
    res.status(500).json({ message: "Error fetching issue", error: error.message });
  }
};


export const addIssueMessage = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { message } = req.body;
    const senderId = req.user._id;
    const userRole = req.user.role;

    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    
    if (userRole !== 'admin' && String(issue.reportedBy) !== String(senderId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    
    issue.messages.push({
      sender: senderId,
      message,
      isAdmin: userRole === 'admin'
    });

    await issue.save();

    
    await issue.populate([
      { path: 'reportedBy', select: 'name email' },
      { path: 'relatedOrder', select: 'paystackReference totalAmount status' },
      { path: 'relatedProduct', select: 'name price' },
      { path: 'relatedSeller', select: 'name email' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'resolvedBy', select: 'name email' },
      { path: 'messages.sender', select: 'name email role' }
    ]);

    
    try {
      const notificationRecipient = userRole === 'admin' ? issue.reportedBy : null;
      if (notificationRecipient) {
        await Notification.create({
          user: notificationRecipient,
          type: "admin_message",
          message: `New message on your issue: ${issue.title}`,
          meta: {
            issueId: issue._id,
            message: message.substring(0, 100) + (message.length > 100 ? '...' : '')
          }
        });
      }
    } catch (notificationError) {
      console.error("Error creating notification:", notificationError);
    }

    res.json({
      message: "Message added successfully",
      issue
    });
  } catch (error) {
    console.error("Error adding message:", error);
    res.status(500).json({ message: "Error adding message", error: error.message });
  }
};


export const getAllIssues = async (req, res) => {
  try {
    const { status, category, priority, page = 1, limit = 20 } = req.query;
    
    
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    const skip = (page - 1) * limit;

    const issues = await Issue.find(filter)
      .populate('reportedBy', 'name email')
      .populate('relatedOrder', 'paystackReference totalAmount status')
      .populate('relatedProduct', 'name price')
      .populate('relatedSeller', 'name email')
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Issue.countDocuments(filter);

    res.json({
      message: "Issues retrieved successfully",
      issues,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error("Error fetching all issues:", error);
    res.status(500).json({ message: "Error fetching issues", error: error.message });
  }
};


export const updateIssueStatus = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { status, adminNotes, resolution } = req.body;
    const adminId = req.user._id;

    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    
    issue.status = status;
    if (adminNotes) issue.adminNotes = adminNotes;
    if (resolution) issue.resolution = resolution;
    
    if (status === 'resolved' || status === 'closed') {
      issue.resolvedAt = new Date();
      issue.resolvedBy = adminId;
    }

    await issue.save();

    
    await issue.populate([
      { path: 'reportedBy', select: 'name email' },
      { path: 'relatedOrder', select: 'paystackReference totalAmount status' },
      { path: 'relatedProduct', select: 'name price' },
      { path: 'relatedSeller', select: 'name email' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'resolvedBy', select: 'name email' }
    ]);

    
    try {
      await Notification.create({
        user: issue.reportedBy,
        type: "admin_message",
        message: `Your issue "${issue.title}" has been ${status}`,
        meta: {
          issueId: issue._id,
          status: status,
          resolution: resolution
        }
      });
    } catch (notificationError) {
      console.error("Error creating notification:", notificationError);
    }

    res.json({
      message: "Issue status updated successfully",
      issue
    });
  } catch (error) {
    console.error("Error updating issue status:", error);
    res.status(500).json({ message: "Error updating issue status", error: error.message });
  }
};


export const assignIssue = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { assignedTo } = req.body;

    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser || assignedUser.role !== 'admin') {
      return res.status(400).json({ message: "Invalid admin user" });
    }

    issue.assignedTo = assignedTo;
    await issue.save();

    
    await issue.populate([
      { path: 'reportedBy', select: 'name email' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'relatedOrder', select: 'paystackReference totalAmount status' },
      { path: 'relatedProduct', select: 'name price' },
      { path: 'relatedSeller', select: 'name email' }
    ]);

    res.json({
      message: "Issue assigned successfully",
      issue
    });
  } catch (error) {
    console.error("Error assigning issue:", error);
    res.status(500).json({ message: "Error assigning issue", error: error.message });
  }
};

