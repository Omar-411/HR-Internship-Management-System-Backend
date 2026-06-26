// Script to reset the MongoDB database (drop all collections) and reseed
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function resetDatabase() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB. Dropping all collections...");
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.drop();
      console.log(`Dropped collection: ${collection.collectionName}`);
    }
    console.log("All collections dropped.");
    await mongoose.disconnect();
    return 0;
  } catch (err) {
    if (err.message === 'ns not found') {
      // Ignore error if collection does not exist
      return 0;
    }
    console.error("Error resetting database:", err);
    process.exit(1);
  }
}

// Run the reset and then reseed
(async () => {
  await resetDatabase();
  // Dynamically import the seed script after reset
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const seedPath = path.join(__dirname, "../seed/seed.js");
  const seedUrl = pathToFileURL(seedPath).href;
  await import(seedUrl);
  // The seed script runs itself on import (see seed.js)
})();
