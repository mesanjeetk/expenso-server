import mongoose from 'mongoose';
import "dotenv/config";
export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MONGODB connected successfully");
        
    } catch (error) {
        console.log("MONGODB connection ERROR: ", error);
        process.exit(1);
    }
}