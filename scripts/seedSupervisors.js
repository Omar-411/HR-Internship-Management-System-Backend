/**
 * Seed script: ensures a "Supervisor" role and inserts demo supervisor users.
 *
 * Run from server folder:
 *   node scripts/seedSupervisors.js
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";

dotenv.config();

const DEFAULT_PASSWORD = "Supervisor123!";

const SUPERVISOR_USERS = [
  
];

async function seedSupervisors() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/HR-DOTJCOM";
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected.\n");

  try {
    // 1. Ensure "Supervisor" role exists
    let supervisorRole = await UserRole.findOne({ name: "Supervisor" });
    if (!supervisorRole) {
      supervisorRole = await UserRole.create({
        name: "Supervisor",
        description: "Supervisor with team management access",
      });
      console.log('Created role: "Supervisor"');
    } else {
      console.log('Role "Supervisor" already exists');
    }

    // 2. Ensure departments exist
    for (const sup of SUPERVISOR_USERS) {
      let dept = await Department.findOne({ name: sup.departmentName });
      if (!dept) {
        dept = await Department.create({
          name: sup.departmentName,
          description: `${sup.departmentName} department`,
        });
        console.log(`Created department: "${sup.departmentName}"`);
      }
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // 3. Create or update supervisors
    for (const sup of SUPERVISOR_USERS) {
      const email = sup.email.toLowerCase().trim();
      const department = await Department.findOne({ name: sup.departmentName });

      const existing = await User.findOne({ email });
      if (existing) {
        await User.updateOne(
          { _id: existing._id },
          {
            $set: {
              name: sup.name,
              lastName: sup.lastName,
              position: sup.position,
              role_id: supervisorRole._id,
              department_id: department?._id,
              status: "Active",
              password: hashedPassword,
              mustResetPassword: false,
              loginAttempts: 0,
            },
          },
        );
        console.log(`Supervisor already existed, updated: ${email}`);
        continue;
      }

      await User.create({
        name: sup.name,
        lastName: sup.lastName,
        email,
        idType: "CIN",
        idNumber: {
          number: String(Math.floor(10000000 + Math.random() * 89999999)),
          countryCode: "TN",
        },
        password: hashedPassword,
        address: "Supervisor Address",
        joinDate: new Date(),
        phoneNumber: "+2165" + Math.floor(1000000 + Math.random() * 8999999),
        position: sup.position,
        status: "Active",
        role_id: supervisorRole._id,
        department_id: department?._id,
        mustResetPassword: false,
        loginAttempts: 0,
      });

      console.log(`Created supervisor user: ${email}`);
    }

    console.log("\nSeeding supervisors completed.");
    console.log(`Default password for all supervisors: ${DEFAULT_PASSWORD}`);
  } catch (err) {
    console.error("Seed supervisors failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
}

seedSupervisors();
