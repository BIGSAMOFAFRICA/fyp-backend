import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import EscrowTransaction from "../models/escrowTransaction.model.js";

export const getAnalyticsData = async () => {
	
	const totalUsers = await User.countDocuments({});
	const totalProducts = await Product.countDocuments({});
	
	// Get all escrow transactions (pending, completed, released)
	const allEscrowTransactions = await EscrowTransaction.find({});
	const totalSales = allEscrowTransactions.length;
	const totalRevenue = allEscrowTransactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
	
	// Get pending transactions
	const pendingTransactions = await EscrowTransaction.find({ 
		status: "pending",
		isConfirmed: false 
	});
	
	// Get completed transactions
	const completedTransactions = await EscrowTransaction.find({ 
		status: "completed",
		isConfirmed: true 
	});
	
	// Get released transactions
	const releasedTransactions = await EscrowTransaction.find({ 
		status: "released" 
	});
	
	// Calculate admin revenue
	const totalAdminRevenue = releasedTransactions.reduce((sum, tx) => sum + tx.adminShare, 0);
	const pendingAdminRevenue = pendingTransactions.reduce((sum, tx) => sum + tx.adminShare, 0);
	
	return {
		users: totalUsers,
		products: totalProducts,
		totalSales,
		totalRevenue,
		pendingTransactions: pendingTransactions.length,
		completedTransactions: completedTransactions.length,
		releasedTransactions: releasedTransactions.length,
		totalAdminRevenue,
		pendingAdminRevenue
	};
};

export const getDailySalesData = async (startDate, endDate) => {
	try {
		
		// Get all escrow transactions in the date range
		const dailySalesData = await EscrowTransaction.aggregate([
			{
				$match: {
					createdAt: {
						$gte: startDate,
						$lte: endDate,
					}
				},
			},
			{
				$group: {
					_id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
					sales: { $sum: 1 },
					revenue: { $sum: "$totalAmount" },
					adminRevenue: { $sum: "$adminShare" },
					sellerRevenue: { $sum: "$sellerShare" }
				},
			},
			{ $sort: { _id: 1 } },
		]);

		
		
		
		
		
		
		
		

		const dateArray = getDatesInRange(startDate, endDate);
		
		return dateArray.map((date) => {
			const foundData = dailySalesData.find((item) => item._id === date);

			return {
				name: date,
				sales: foundData?.sales || 0,
				revenue: foundData?.revenue || 0,
				adminRevenue: foundData?.adminRevenue || 0,
				sellerRevenue: foundData?.sellerRevenue || 0,
			};
		});
	} catch (error) {
		throw error;
	}
};

function getDatesInRange(startDate, endDate) {
	const dates = [];
	let currentDate = new Date(startDate);

	while (currentDate <= endDate) {
		dates.push(currentDate.toISOString().split("T")[0]);
		currentDate.setDate(currentDate.getDate() + 1);
	}

	return dates;
}

export const resetAnalytics = async (req, res) => {
	res.json({
		users: 0,
		products: 0,
		totalSales: 0,
		totalRevenue: 0,
		dailySalesData: [],
	});
};
