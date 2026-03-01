import mongoose from "mongoose";

let isConnected = false; // evita reconexiones innecesarias en serverless

const connectDB = async () => {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI no está definido en las variables de entorno");
  }

  try {
    const conn = await mongoose.connect(uri);
    isConnected = conn.connections[0].readyState === 1;
    console.log("MongoDB connected");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    throw error;
  }
};

export default connectDB;
