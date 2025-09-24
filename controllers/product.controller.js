// Fetch products for a seller grouped by status
export const getSellerProductsByStatus = async (req, res) => {
	try {
		const sellerId = req.user._id;
		const products = await Product.find({ sellerId });
		const grouped = {
			pending: [],
			approved: [],
			rejected: []
		};
		for (const p of products) {
			if (grouped[p.status]) grouped[p.status].push(p);
		}
		res.json(grouped);
	} catch (error) {
		res.status(500).json({ message: "Failed to fetch seller products", error: error.message });
	}
};
import { redis } from "../lib/redis.js";
import cloudinary from "../lib/cloudinary.js";
import Product from "../models/product.model.js";
import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";

// List products for the authenticated seller (flat list)
export const getSellerProducts = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });
        const query = req.user.role === "admin" ? {} : { sellerId: req.user._id };
        const products = await Product.find(query).sort({ createdAt: -1 });
        res.json({ products });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch products", error: error.message });
    }
};

export const getApprovedProducts = async (req, res) => {
	try {
		const products = await Product.find({ status: "approved" });
		res.json({ products });
	} catch (error) {
		console.log("Error in getApprovedProducts controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const getPendingProducts = async (req, res) => {
	try {
		const products = await Product.find({ status: "pending" });
		res.json({ products });
	} catch (error) {
		console.log("Error in getPendingProducts controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const approveProduct = async (req, res) => {
	try {
		// Only admin can approve
		if (!req.user || req.user.role !== "admin") {
			return res.status(403).json({ message: "Forbidden: Admins only" });
		}
		const product = await Product.findById(req.params.id);
		if (!product) return res.status(404).json({ message: "Product not found" });
		product.status = "approved";
		await product.save();
		// Notify seller if exists
		if (product.seller) {
			const seller = await User.findById(product.seller);
			if (seller) {
				await Notification.create({
					user: seller._id,
					type: "product_approved",
					message: `Your product '${product.name}' was approved!`,
					meta: { productId: product._id },
				});
			}
		}
		res.json(product);
	} catch (error) {
		console.log("Error in approveProduct controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const rejectProduct = async (req, res) => {
	try {
		// Only admin can reject
		if (!req.user || req.user.role !== "admin") {
			return res.status(403).json({ message: "Forbidden: Admins only" });
		}
		const product = await Product.findById(req.params.id);
		if (!product) return res.status(404).json({ message: "Product not found" });
		product.status = "rejected";
		await product.save();
		// Notify seller if exists
		if (product.seller) {
			const seller = await User.findById(product.seller);
			if (seller) {
				await Notification.create({
					user: seller._id,
					type: "product_rejected",
					message: `Your product '${product.name}' was rejected.`,
					meta: { productId: product._id },
				});
			}
		}
		res.json(product);
	} catch (error) {
		console.log("Error in rejectProduct controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const getAllProducts = async (req, res) => {
	try {
		const products = await Product.find({}); // find all products
		res.json({ products });
	} catch (error) {
		console.log("Error in getAllProducts controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const getFeaturedProducts = async (req, res) => {
	try {
		// Try to get from Redis cache first
		let featuredProducts;
		try {
			featuredProducts = await redis.get("featured_products");
			if (featuredProducts) {
				return res.json(JSON.parse(featuredProducts));
			}
		} catch (redisError) {
			console.log("Redis error in getFeaturedProducts, falling back to database", redisError.message);
			// Continue to database query if Redis fails
		}

		// Get from database
		featuredProducts = await Product.find({ isFeatured: true, status: "approved" }).lean();
		if (!featuredProducts || featuredProducts.length === 0) {
			return res.status(404).json({ message: "No featured products found" });
		}

		// Try to cache in Redis, but don't fail if Redis is unavailable
		try {
			await redis.set("featured_products", JSON.stringify(featuredProducts));
		} catch (redisError) {
			console.log("Failed to cache featured products in Redis", redisError.message);
			// Continue without caching
		}

		res.json(featuredProducts);
	} catch (error) {
		console.log("Error in getFeaturedProducts controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const createProduct = async (req, res) => {
	try {
		   const { name, description, price, image, category } = req.body;


		   // Validate required fields
		   if (!req.user || !req.user._id) {
			   return res.status(401).json({ message: "Unauthorized: Seller not found" });
		   }
		   if (!name || !description || !price || !category) {
			   return res.status(400).json({ message: "Missing required fields: name, description, price, or category" });
		   }
		   if (!image) {
			   return res.status(400).json({ message: "Image is required" });
		   }
		   if (req.user.role === "seller" && !req.user._id) {
			   return res.status(400).json({ message: "sellerId is required for seller product uploads" });
		   }

		   let cloudinaryResponse = null;
		   try {
			   cloudinaryResponse = await cloudinary.uploader.upload(image, { folder: "products" });
		   } catch (err) {
			   return res.status(400).json({ message: "Image upload failed", error: err.message });
		   }


		   const productData = {
			   name,
			   description,
			   price,
			   image: cloudinaryResponse?.secure_url || "",
			   category,
			   sellerId: req.user._id,
			   status: req.user.role === "admin" ? "approved" : "pending"
		   };

		   const product = await Product.create(productData);
		   res.status(201).json(product);
	} catch (error) {
		console.log("Error in createProduct controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const deleteProduct = async (req, res) => {
	try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });
        const product = await Product.findById(req.params.id);
		if (!product) {
			return res.status(404).json({ message: "Product not found" });
		}
        // Allow admins or the owning seller to delete
        const isOwner = String(product.sellerId) === String(req.user._id);
        const isAdmin = req.user.role === "admin";
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: "Forbidden" });
        }
		if (product.image) {
			const publicId = product.image.split("/").pop().split(".")[0];
			try {
				await cloudinary.uploader.destroy(`products/${publicId}`);
				console.log("deleted image from cloduinary");
			} catch (error) {
				console.log("error deleting image from cloduinary", error);
			}
		}
		await Product.findByIdAndDelete(req.params.id);
		res.json({ message: "Product deleted successfully" });
	} catch (error) {
		console.log("Error in deleteProduct controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

// Update a product (seller can update own product; sets status back to pending)
export const updateProduct = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });

        const isOwner = String(product.sellerId) === String(req.user._id);
        const isAdmin = req.user.role === "admin";
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const { name, description, price, image, category } = req.body;

        if (typeof name === 'string') product.name = name;
        if (typeof description === 'string') product.description = description;
        if (typeof price !== 'undefined') product.price = price;
        if (typeof category === 'string') product.category = category;

        // If new image provided as data URL, upload and replace existing
        if (image && typeof image === 'string' && image.startsWith('data:')) {
            try {
                const uploadRes = await cloudinary.uploader.upload(image, { folder: 'products' });
                product.image = uploadRes?.secure_url || product.image;
            } catch (err) {
                return res.status(400).json({ message: 'Image upload failed', error: err.message });
            }
        }

        // If seller updates, set status back to pending for re-approval
        if (!isAdmin) {
            product.status = 'pending';
        }

        await product.save();
        res.json(product);
    } catch (error) {
        console.log('Error in updateProduct controller', error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const getRecommendedProducts = async (req, res) => {
	try {
		const products = await Product.aggregate([
			{ $match: { status: "approved" } },
			{ $sample: { size: 4 } },
			{ $project: { _id: 1, name: 1, description: 1, image: 1, price: 1 } },
		]);
		res.json(products);
	} catch (error) {
		console.log("Error in getRecommendedProducts controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const getProductsByCategory = async (req, res) => {
	const { category } = req.params;
	try {
		const products = await Product.find({ category, status: "approved" });
		res.json({ products });
	} catch (error) {
		console.log("Error in getProductsByCategory controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const toggleFeaturedProduct = async (req, res) => {
	try {
		const product = await Product.findById(req.params.id);
		if (product) {
			product.isFeatured = !product.isFeatured;
			const updatedProduct = await product.save();
			await updateFeaturedProductsCache();
			res.json(updatedProduct);
		} else {
			res.status(404).json({ message: "Product not found" });
		}
	} catch (error) {
		console.log("Error in toggleFeaturedProduct controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

async function updateFeaturedProductsCache() {
	try {
		const featuredProducts = await Product.find({ isFeatured: true, status: "approved" }).lean();
		await redis.set("featured_products", JSON.stringify(featuredProducts));
	} catch (error) {
		console.log("error in update cache function");
	}
}
