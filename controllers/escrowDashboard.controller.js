import EscrowTransaction from "../models/escrowTransaction.model.js";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";


export const getSellerEscrowDashboard = async (req, res) => {
	try {
		const sellerId = req.user._id;
		
		
		const seller = await User.findById(sellerId).select("name email");
		if (!seller) {
			return res.status(404).json({ message: "Seller not found" });
		}
		
		
		const transactions = await EscrowTransaction.find({ sellerId })
			.populate('buyerId', 'name email')
			.populate('productId', 'name price')
			.sort({ createdAt: -1 });
		
		
		const sellerData = await User.findById(sellerId).select("totalEarnings pendingEarnings");
		
		
		const releasedTransactions = transactions.filter(tx => tx.status === "released");
		const pendingTransactions = transactions.filter(tx => tx.status === "pending");
		
		const totalEarnings = sellerData.totalEarnings || 0;
		const pendingEarnings = sellerData.pendingEarnings || 0;
		const totalRevenue = releasedTransactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
		
		
		const soldProducts = await Product.find({ 
			sellerId, 
			status: "sold" 
		}).populate('buyerId', 'name email');
		
		res.json({
			seller: {
				id: seller._id,
				name: seller.name,
				email: seller.email
			},
			earnings: {
				totalEarnings,
				pendingEarnings,
				totalRevenue
			},
			transactions,
			soldProducts,
			stats: {
				totalTransactions: transactions.length,
				releasedTransactions: releasedTransactions.length,
				pendingTransactions: pendingTransactions.length,
				totalProductsSold: soldProducts.length
			}
		});
	} catch (error) {
		console.error("Error fetching seller escrow dashboard:", error);
		res.status(500).json({ message: "Error fetching seller dashboard", error: error.message });
	}
};


export const getBuyerEscrowDashboard = async (req, res) => {
	try {
		const buyerId = req.user._id;
		
		
		const buyer = await User.findById(buyerId).select("name email");
		if (!buyer) {
			return res.status(404).json({ message: "Buyer not found" });
		}
		
		
		const transactions = await EscrowTransaction.find({ buyerId })
			.populate('sellerId', 'name email')
			.populate('productId', 'name price')
			.sort({ createdAt: -1 });
		
		
		const purchasedProducts = await Product.find({ 
			buyerId, 
			status: "sold" 
		}).populate('sellerId', 'name email');
		
		
		const totalSpent = transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
		const pendingSpent = transactions
			.filter(tx => tx.status === "pending")
			.reduce((sum, tx) => sum + tx.totalAmount, 0);
		
		res.json({
			buyer: {
				id: buyer._id,
				name: buyer.name,
				email: buyer.email
			},
			spending: {
				totalSpent,
				pendingSpent
			},
			transactions,
			purchasedProducts,
			stats: {
				totalTransactions: transactions.length,
				pendingTransactions: transactions.filter(tx => tx.status === "pending").length,
				completedTransactions: transactions.filter(tx => tx.status === "released").length,
				totalProductsPurchased: purchasedProducts.length
			}
		});
	} catch (error) {
		console.error("Error fetching buyer escrow dashboard:", error);
		res.status(500).json({ message: "Error fetching buyer dashboard", error: error.message });
	}
};


export const getEscrowTransactionDetails = async (req, res) => {
	try {
		const { transactionId } = req.params;
		const userId = req.user._id;
		const userRole = req.user.role;
		
		
		const transaction = await EscrowTransaction.findById(transactionId)
			.populate('buyerId', 'name email')
			.populate('sellerId', 'name email')
			.populate('productId', 'name price description image');
		
		if (!transaction) {
			return res.status(404).json({ message: "Transaction not found" });
		}
		
		
		const isBuyer = String(transaction.buyerId._id) === String(userId);
		const isSeller = String(transaction.sellerId._id) === String(userId);
		const isAdmin = userRole === "admin";
		
		if (!isBuyer && !isSeller && !isAdmin) {
			return res.status(403).json({ message: "Access denied" });
		}
		
		res.json({ transaction });
	} catch (error) {
		console.error("Error fetching transaction details:", error);
		res.status(500).json({ message: "Error fetching transaction details", error: error.message });
	}
};
