import mongoose from "mongoose";

const issueSchema = new mongoose.Schema(
  {
    
    title: {
      type: String,
      required: [true, "Issue title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"]
    },
    description: {
      type: String,
      required: [true, "Issue description is required"],
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"]
    },
    category: {
      type: String,
      required: [true, "Issue category is required"],
      enum: ["payment", "delivery", "product_quality", "seller_issue", "technical", "refund", "other"],
      default: "other"
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium"
    },
    
    
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EscrowTransaction",
      default: null
    },
    relatedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null
    },
    relatedSeller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    
    
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open"
    },
    
    
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    adminNotes: {
      type: String,
      default: null,
      maxlength: [500, "Admin notes cannot exceed 500 characters"]
    },
    resolution: {
      type: String,
      default: null,
      maxlength: [500, "Resolution cannot exceed 500 characters"]
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    
    
    messages: [{
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      message: {
        type: String,
        required: true,
        maxlength: [500, "Message cannot exceed 500 characters"]
      },
      isAdmin: {
        type: Boolean,
        default: false
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    
    
    attachments: [{
      filename: String,
      url: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  { timestamps: true }
);


issueSchema.index({ reportedBy: 1, status: 1 });
issueSchema.index({ status: 1, createdAt: -1 });
issueSchema.index({ assignedTo: 1, status: 1 });
issueSchema.index({ category: 1, priority: 1 });

const Issue = mongoose.model("Issue", issueSchema);

export default Issue;

