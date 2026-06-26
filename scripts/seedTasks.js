/**
 * Seed script: creates demo tasks for each project and assigns them to users.
 *
 * Run from server folder:
 *   node scripts/seedTasks.js
 *
 * Optional flags:
 *   --wipe-existing    Delete existing tasks before seeding
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import User from "../models/User.js";

dotenv.config();

const WIPE_EXISTING = process.argv.includes("--wipe-existing");

const DEMO_TASKS = [
  {
    name: "Design Database Schema",
    description: "Create and finalize the ERD for the project.",
    status: "done",
  },
  {
    name: "Implement Authentication",
    description: "Set up JWT-based authentication and authorization.",
    status: "in_progress",
  },
  {
    name: "Frontend UI Mockups",
    description: "Design Figma mockups for all main screens.",
    status: "todo",
  },
  {
    name: "API Integration",
    description: "Connect frontend to backend REST APIs.",
    status: "todo",
  },
  {
    name: "Write Unit Tests",
    description: "Add Jest tests for all critical modules.",
    status: "todo",
  },
];

async function getUsers() {
  return User.find({ status: "Active", isActive: true }).select("_id name lastName email");
}

async function seedTasks() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/HR-DOTJCOM";
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected.\n");

  try {
    const projects = await Project.find({});
    const users = await getUsers();
    if (projects.length === 0) throw new Error("No projects found. Seed projects first.");
    if (users.length === 0) throw new Error("No users found. Seed users first.");

    if (WIPE_EXISTING) {
      const deletion = await Task.deleteMany({});
      console.log(`Deleted ${deletion.deletedCount} existing task(s).`);
    }

    let taskCount = 0;
    for (const project of projects) {
      for (let i = 0; i < DEMO_TASKS.length; i++) {
        const user = users[(taskCount + i) % users.length];
        const payload = DEMO_TASKS[i];
        await Task.updateOne(
          { name: payload.name, projectId: project._id },
          {
            $set: {
              ...payload,
              userId: user._id,
              projectId: project._id,
              dueDate: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000), // staggered due dates
              completedAt: payload.status === "done" ? new Date() : null,
            },
          },
          { upsert: true }
        );
        taskCount++;
        console.log(`Upserted task "${payload.name}" for project "${project.name}" → user: ${user.name} ${user.lastName || ""}`.trim());
      }
    }

    console.log("\nTask seeding complete.");
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
}

seedTasks().catch((err) => {
  console.error("Seed tasks failed:", err);
  process.exit(1);
});
