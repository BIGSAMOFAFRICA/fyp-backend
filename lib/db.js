import mongoose from "mongoose";

export const connectDB = async () => {
	try {
		// Validate environment variable
		if (!process.env.MONGO_URI) {
			throw new Error("MONGO_URI environment variable is not defined");
		}

		// Set mongoose options for better connection handling
		mongoose.set('strictQuery', false);
		
		const options = {
			maxPoolSize: 10, // Maintain up to 10 socket connections
			serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
			socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
			family: 4 // Use IPv4, skip trying IPv6
		};

		console.log("🔍 Attempting to connect to MongoDB...");
		const conn = await mongoose.connect(process.env.MONGO_URI, options);
		console.log(`✅ MongoDB connected successfully: ${conn.connection.host}`);
		
		// Handle connection events
		mongoose.connection.on('error', (err) => {
			console.error('❌ MongoDB connection error:', err.message);
		});

		mongoose.connection.on('disconnected', () => {
			console.log('⚠️ MongoDB disconnected');
		});

		mongoose.connection.on('reconnected', () => {
			console.log('✅ MongoDB reconnected');
		});

	} catch (error) {
		console.error("❌ Error connecting to MongoDB:", error.message);
		console.error("Full error:", error);
		
		// Don't exit process immediately, let the application handle it
		throw error;
	}
};
