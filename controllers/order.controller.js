import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";


export const getSellerOrders = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const orders = await Order.find({ "products.product": { $exists: true } })
      .populate({
        path: "products.product",
        match: { seller: sellerId },
      })
      .populate("user", "name email");
    
    const sellerOrders = orders.filter(order =>
      order.products.some(p => p.product && p.product.seller && p.product.seller.equals(sellerId))
    );
    res.json({ orders: sellerOrders });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const getSellerRevenue = async (req, res) => {
  try {
    const sellerId = req.user._id;
    
    const approvedProducts = await Product.find({ seller: sellerId, status: "approved" }).select("_id");
    const productIds = approvedProducts.map(p => p._id);
    
    const orders = await Order.find({ "products.product": { $in: productIds } });
    let totalRevenue = 0;
    orders.forEach(order => {
      order.products.forEach(item => {
        if (productIds.some(id => id.equals(item.product))) {
          totalRevenue += item.price * item.quantity;
        }
      });
    });
    res.json({ revenue: totalRevenue });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const getMarketplaceAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const orders = await Order.find();
    let totalRevenue = 0;
    orders.forEach(order => {
      order.products.forEach(item => {
        totalRevenue += item.price * item.quantity;
      });
    });
    res.json({ totalUsers, totalProducts, totalRevenue });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
