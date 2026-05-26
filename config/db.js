import dotenv from "dotenv";
import mongoose from "mongoose";

// Load the appropriate .env file
if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: ".env.test" });
} else {
  dotenv.config();
}

// Connect MongoDB based on the NODE_ENV + retry logic for replica sets
const connectMongo = async (retryCount = 5) => {
  const URI =
    process.env.NODE_ENV === "test"
      ? process.env.MONGO_URI_TEST
      : process.env.MONGO_URI;

  for (let i = 0; i < retryCount; i++) {
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(URI, {
          serverSelectionTimeoutMS: 5000,
        });
        console.log(`MongoDB Connected (Replica Set ready)!`);
        return;
      } else {
        console.log("MongoDB Already Connected!");
        return;
      }
    } catch (err) {
      console.error(`MongoDB connection attempt ${i + 1} failed. Retrying in 5s...`);
      if (i === retryCount - 1) {
        console.error("Max retries reached. Ensure MongoDB is running as a replica set (rs0).");
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

export default connectMongo;
