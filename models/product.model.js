import mongoose from "mongoose";


const productSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		description: { type: String, required: true },
		price: { type: Number, min: 0, required: true },
		image: { type: String, required: [true, "Image is required"] },
		category: { type: String, required: true },
		isFeatured: { type: Boolean, default: false },
	       status: {
		       type: String,
		       enum: ["pending", "approved", "rejected", "active", "sold"],
		       default: "pending",
	       },
		sellerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		buyerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			default: null,
		},
	},
	{ timestamps: true }
);


productSchema.index({ sellerId: 1 });
productSchema.index({ status: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ isFeatured: 1, status: 1 });
productSchema.index({ status: 1, createdAt: -1 });

const Product = mongoose.model("Product", productSchema);

export default Product;
