import mongoose from "mongoose";
import dotenv from "dotenv";
import { nanoid } from "nanoid";
import User from "../models/User.js";
import Project from "../models/Project.js";

dotenv.config();

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const users = await User.find({ publicId: { $exists: false } });
    console.log(`Found ${users.length} users without publicId`);
    for (const user of users) {
      await User.updateOne({ _id: user._id }, { $set: { publicId: nanoid(10) } });
    }
    console.log("Users migration complete");

    const projects = await Project.find({ publicId: { $exists: false } });
    console.log(`Found ${projects.length} projects without publicId`);
    for (const project of projects) {
      await Project.updateOne({ _id: project._id }, { $set: { publicId: nanoid(10) } });
    }
    console.log("Projects migration complete");

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migrate();
