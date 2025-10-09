
import express from "express";
const router = express.Router();
import {
    createProduct,
    deleteProduct,
    getAllProducts,
    getFeaturedProducts,
    getProductsByCategory,
    getRecommendedProducts,
    toggleFeaturedProduct,
    getPendingProducts,
    approveProduct,
    rejectProduct,
    getApprovedProducts,
    getSellerProductsByStatus,
    getSellerProducts,
    updateProduct
} from "../controllers/product.controller.js";
import { protectRoute, requireRole, strictAdminOnly } from "../middleware/auth.middleware.js";
import Product from "../models/product.model.js";




router.get("/", getApprovedProducts);
router.get("/featured", getFeaturedProducts);
router.get("/category/:category", getProductsByCategory);
router.get("/recommendations", getRecommendedProducts);


router.get("/seller/:sellerId/grouped", protectRoute, requireRole("seller"), async (req, res) => {
	try {
		const sellerId = req.params.sellerId;
		const grouped = await Product.aggregate([
			{ $match: { sellerId: Product.schema.path('sellerId').instance === 'ObjectID' ? require('mongoose').Types.ObjectId(sellerId) : sellerId } },
			{ $group: { _id: "$status", count: { $sum: 1 } } }
		]);
		const result = { pending: 0, approved: 0, rejected: 0 };
		grouped.forEach(g => { result[g._id] = g.count; });
		res.json(result);
	} catch (err) {
		res.status(500).json({ message: "Server error", error: err.message });
	}
});


router.get("/mine", protectRoute, getSellerProducts);


router.post("/", protectRoute, requireRole("seller"), createProduct);


router.get("/pending", protectRoute, strictAdminOnly, getPendingProducts);

router.patch("/:id/approve", protectRoute, strictAdminOnly, approveProduct);
router.patch("/:id/reject", protectRoute, strictAdminOnly, rejectProduct);

router.delete("/:id", protectRoute, deleteProduct);
router.patch("/:id", protectRoute, strictAdminOnly, toggleFeaturedProduct);


router.put("/:id", protectRoute, updateProduct);

router.get("/all", protectRoute, strictAdminOnly, getAllProducts);



export default router;



