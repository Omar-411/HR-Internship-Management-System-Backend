// Repair stale project data: assign product owner, normalize status,
// backfill required fields, and wire up teams + team members.
// Run from the server directory: node scratch/repair_projects.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { nanoid } from "nanoid";
import connectMongo from "../config/db.js";
import Project from "../models/Project.js";
import Team from "../models/Team.js";
import TeamMember from "../models/TeamMember.js";
import User from "../models/User.js";

dotenv.config();

const STATUS_MAP = {
  in_progress: "Active",
  active: "Active",
  planning: "Planning",
  completed: "Completed",
  done: "Completed",
  on_hold: "On Hold",
  archived: "Archived",
};
const VALID_STATUSES = ["Planning", "Active", "Completed", "On Hold", "Archived"];

const slugify = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const run = async () => {
  await connectMongo();

  const supervisor = await User.findOne({ email: "supervisor@hr.local" });
  const members = await User.find({
    email: { $in: ["employee1@hr.local", "employee2@hr.local", "intern@hr.local"] },
  });
  if (!supervisor) throw new Error("Seeded supervisor not found — run npm run seed first.");

  const memberRoles = {
    "employee1@hr.local": "Fullstack Developer",
    "employee2@hr.local": "QA Engineer",
    "intern@hr.local": "Frontend Developer",
  };

  const projects = await Project.collection.find({}).toArray();

  for (const p of projects) {
    const update = {};

    if (!p.productOwnerId) update.productOwnerId = supervisor._id;

    if (!VALID_STATUSES.includes(p.status)) {
      update.status = STATUS_MAP[String(p.status).toLowerCase()] || "Planning";
    }

    if (!p.publicId) update.publicId = nanoid(10);
    if (!p.slug) update.slug = slugify(p.name);
    if (!p.dueDate) update.dueDate = new Date("2026-12-31");
    if (!p.startDate) update.startDate = new Date("2026-01-01");

    // Ensure the project has a team, and the team points back at the project
    let team = p.team_id
      ? await Team.findById(p.team_id)
      : await Team.findOne({ projectId: p._id });

    if (!team) {
      team = await Team.create({ name: `${p.name} Team`, projectId: p._id });
      console.log(`Created team for project: ${p.name}`);
    }
    if (!team.projectId || team.projectId.toString() !== p._id.toString()) {
      team.projectId = p._id;
      await team.save();
    }
    if (!p.team_id || p.team_id.toString() !== team._id.toString()) {
      update.team_id = team._id;
    }

    if (Object.keys(update).length > 0) {
      await Project.collection.updateOne({ _id: p._id }, { $set: update });
      console.log(`Repaired project "${p.name}":`, Object.keys(update).join(", "));
    }

    // Seed team members (idempotent via unique index on teamId+userId)
    for (const m of members) {
      const exists = await TeamMember.findOne({ teamId: team._id, userId: m._id });
      if (!exists) {
      await TeamMember.create({
          teamId: team._id,
          userId: m._id,
          role: memberRoles[m.email] || "Backend Developer",
        });
        console.log(`  Added ${m.email} to "${team.name}"`);
      }
    }
  }

  // Final sanity check: no project should be missing productOwnerId
  const stillBroken = await Project.collection.countDocuments({
    productOwnerId: { $exists: false },
  });
  console.log(`\nDone. Projects still missing productOwnerId: ${stillBroken}`);

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.connection.close();
  process.exit(1);
});
