import mongoose from "mongoose";

const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...✅");
    
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB Connected 🔥");
  } catch (error) {
    console.log("❌ DB Error:", error.message);
  }
};

export default connectDB;