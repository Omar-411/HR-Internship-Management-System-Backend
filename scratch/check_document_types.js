import mongoose from "mongoose";
import dotenv from "dotenv";
import connectMongo from "../config/db.js";
import DocumentType from "../models/DocumentType.js";

dotenv.config();

const run = async () => {
  await connectMongo();
  const types = await DocumentType.find({});
  console.log("=== EXISTING DOCUMENT TYPES ===");
  console.log(types.map(t => ({ id: t._id, name: t.name })));
  mongoose.connection.close();
};

run().catch(console.error);
