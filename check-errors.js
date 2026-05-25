import dotenv from "dotenv";
import mongoose from "mongoose";
import Project from "./models/Project.js";
import connectMongo from "./config/db.js";

async function run() {
  await connectMongo();
  
  const projects = await Project.find({ aiEvaluationStatus: "Failed" }).select("name aiEvaluationError");
  console.log("Failed projects:", JSON.stringify(projects, null, 2));

  process.exit(0);
}

run().catch(console.error);
