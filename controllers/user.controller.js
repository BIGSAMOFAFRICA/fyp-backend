import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";
import EscrowTransaction from "../models/escrowTransaction.model.js";


export const getAllUsers = async (req, res) => {
	try {
		const users = await User.find({}, { password: 0, resetPasswordToken: 0 })
			.sort({ createdAt: -1 });
		
		res.json({
			success: true,
			users: users
		});
	} catch (error) {
		console.error("Error fetching users:", error);
		res.status(500).json({ 
			success: false,
			message: "Error fetching users", 
			error: error.message 
		});
	}
};


export const deleteUser = async (req, res) => {
	try {
		const { userId } = req.params;
		
		
		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({ 
				success: false,
				message: "User not found" 
			});
		}
		
		
		if (String(userId) === String(req.user._id)) {
			return res.status(400).json({ 
				success: false,
				message: "Cannot delete your own account" 
			});
		}
		
		
		await Product.deleteMany({ seller: userId });
		
		
		await Order.deleteMany({ user: userId });
		
		
		await EscrowTransaction.deleteMany({ 
			$or: [{ buyerId: userId }, { sellerId: userId }] 
		});
		
		
		await User.findByIdAndDelete(userId);
		
		res.json({
			success: true,
			message: "User account deleted successfully"
		});
	} catch (error) {
		console.error("Error deleting user:", error);
		res.status(500).json({ 
			success: false,
			message: "Error deleting user", 
			error: error.message 
		});
	}
};


export const updateUserRole = async (req, res) => {
	try {
		const { userId } = req.params;
		const { role } = req.body;
		
		
		if (!['buyer', 'seller', 'admin'].includes(role)) {
			return res.status(400).json({ 
				success: false,
				message: "Empty role. Must be buyer, seller, or admin" 
			});
		}
		
		
		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({ 
				success: false,
				message: "User not found" 
			});
		}
		
		
		user.role = role;
		await user.save();
		
		res.json({
			success: true,
			message: "User role updated successfully",
			user: {
				_id: user._id,
				name: user.name,
				email: user.email,
				role: user.role
			}
		});
	} catch (error) {
		console.error("Error updating user role:", error);
		res.status(500).json({ 
			success: false,
			message: "Error updating user role", 
			error: error.message 
		});
	}
};

