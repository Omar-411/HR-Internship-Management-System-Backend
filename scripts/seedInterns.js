/**
 * Seed script: creates an "Intern" role if missing and
 * inserts 5 demo intern users for testing.
 *
 * Run from server folder:
 *   node scripts/seedInterns.js
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";

dotenv.config();

const DEFAULT_PASSWORD = "Intern123!";

const INTERN_USERS = [
  {
    name: "Malek",
    lastName: "Bensalah",
    email: "malek.intern@dotjcom.com",
    position: "Frontend Intern",
  },
  {
    name: "Taher",
    lastName: "Akrout",
    email: "taher.intern@dotjcom.com",
    position: "UI/UX Intern",
  },
  {
    name: "Yasmine",
    lastName: "Hmida",
    email: "yasmine.intern@dotjcom.com",
    position: "Data & Analytics Intern",
  },
  {
    name: "Hiba",
    lastName: "Boulifa",
    email: "hiba.intern@dotjcom.com",
    position: "Mobile & AI Intern",
  },
  
 
];

async function seedInterns() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/HR-DOTJCOM";
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected.\n");

  try {
    // 1. Ensure "Intern" role exists
    let internRole = await UserRole.findOne({ name: "Intern" });
    if (!internRole) {
      internRole = await UserRole.create({
        name: "Intern",
        description: "Intern with limited access",
      });
      console.log('Created role: "Intern"');
    } else {
      console.log('Role "Intern" already exists');
    }

    // 2. Ensure a generic "Interns" department exists (optional)
    let internsDept = await Department.findOne({ name: "Interns" });
    if (!internsDept) {
      internsDept = await Department.create({
        name: "Interns",
        description: "Department for interns / trainees",
      });
      console.log('Created department: "Interns"');
    } else {
      console.log('Department "Interns" already exists');
    }

    // 3. Create or update each intern
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    for (const intern of INTERN_USERS) {
      const email = intern.email.toLowerCase().trim();
      const existing = await User.findOne({ email });

      if (existing) {
        await User.updateOne(
          { _id: existing._id },
          {
            $set: {
              name: intern.name,
              lastName: intern.lastName,
              position: intern.position,
              role_id: internRole._id,
              department_id: internsDept._id,
              status: "Active",
              password: hashedPassword,
              mustResetPassword: false,
              loginAttempts: 0,
            },
          },
        );
        console.log(`Intern already existed, updated credentials: ${email}`);
        continue;
      }

      await User.create({
        name: intern.name,
        lastName: intern.lastName,
        email,
        idType: "CIN",
        idNumber: {
          number: String(Math.floor(10000000 + Math.random() * 89999999)),
          countryCode: "TN",
        },
        password: hashedPassword,
        address: "Intern Address",
        joinDate: new Date(),
        phoneNumber: "+2169" + Math.floor(1000000 + Math.random() * 8999999),
        position: intern.position,
        status: "Active",
        role_id: internRole._id,
        department_id: internsDept._id,
        mustResetPassword: false,
        loginAttempts: 0,
      });

      console.log(`Created intern user: ${email}`);
    }

    console.log("\nSeeding interns completed.");
    console.log(`Default password for all interns: ${DEFAULT_PASSWORD}`);
  } catch (err) {
    console.error("Seed interns failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
}

seedInterns();
