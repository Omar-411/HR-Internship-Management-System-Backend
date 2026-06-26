/**
 * Seed script: creates demo projects for supervisors.
 *
 * Run from server folder:
 *   node scripts/seedProjects.js
 *
 * Optional flags:
 *   --wipe-existing    Delete existing projects before seeding
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import Project from "../models/Project.js";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";

dotenv.config();

const WIPE_EXISTING = process.argv.includes("--wipe-existing");

const DEMO_PROJECTS = [
  {
    name: "HR Management System",
    description: "Building a comprehensive HR dashboard for internal operations.",
    status: "in_progress",
    totalSubTasks: 24,
    completedSubTasks: 11,
    dueDate: "2026-09-30",
  },
  {
    name: "Internal API Gateway",
    description: "Centralized API gateway with monitoring and access control.",
    status: "at_risk",
    totalSubTasks: 18,
    completedSubTasks: 7,
    dueDate: "2026-08-20",
  },
  {
    name: "Attendance Analytics",
    description: "Analytics module for attendance trends, anomalies, and exports.",
    status: "pending",
    totalSubTasks: 12,
    completedSubTasks: 0,
    dueDate: "2026-10-15",
  },
  {
    name: "Leave Workflow Automation",
    description: "Automation for leave request approvals and notifications.",
    status: "done",
    totalSubTasks: 16,
    completedSubTasks: 16,
    dueDate: "2026-06-10",
  },
];

async function getSupervisors() {
  const supervisorRole = await UserRole.findOne({ name: "Supervisor" }).select("_id");

  if (supervisorRole) {
    const supervisors = await User.find({
      role_id: supervisorRole._id,
      status: "Active",
      isActive: true,
    }).select("_id name lastName email");

    if (supervisors.length > 0) {
      return supervisors;
    }
  }

  // Fallback to any active users so this script can still seed projects
  // even if Supervisor users are not seeded yet.
  return User.find({ status: "Active", isActive: true })
    .select("_id name lastName email")
    .limit(5);
}

async function seedProjects() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/HR-DOTJCOM";
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected.\n");

  try {
    const supervisors = await getSupervisors();
    if (supervisors.length === 0) {
      throw new Error(
        "No active users found to assign as supervisors. Seed users first (e.g. npm run seed:admin)."
      );
    }

    if (WIPE_EXISTING) {
      const deletion = await Project.deleteMany({});
      console.log(`Deleted ${deletion.deletedCount} existing project(s).`);
    }

    for (let i = 0; i < DEMO_PROJECTS.length; i += 1) {
      const supervisor = supervisors[i % supervisors.length];
      const payload = DEMO_PROJECTS[i];

      await Project.updateOne(
        { name: payload.name },
        {
          $set: {
            ...payload,
            supervisor_id: supervisor._id,
            dueDate: new Date(payload.dueDate),
          },
        },
        { upsert: true }
      );

      console.log(
        `Upserted project "${payload.name}" -> supervisor: ${supervisor.name} ${supervisor.lastName || ""}`.trim()
      );
    }

    console.log("\nProject seeding complete.");
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
}

seedProjects().catch((err) => {
  console.error("Seed projects failed:", err);
  process.exit(1);
});
