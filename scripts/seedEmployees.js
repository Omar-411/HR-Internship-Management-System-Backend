/**
 * Seed script: ensures an "Employee" role and inserts demo employee users.
 *
 * Run from server folder:
 *   node scripts/seedEmployees.js
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";

dotenv.config();

const DEFAULT_PASSWORD = "Employee123!";

const EMPLOYEE_USERS = [
  {
    name: " ",
    lastName: " ",
    email: "omar@dotjcom.com",
    position: "Software Engineer",
    departmentName: "IT",
  },
  {
    name: "Ya",
    lastName: "Employee",
    email: "sara.employee@dotjcom.com",
    position: "HR Specialist",
    departmentName: "HR",
  },
];

async function seedEmployees() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/HR-DOTJCOM";
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected.\n");

  try {
    // 1. Ensure "Employee" role exists
    let employeeRole = await UserRole.findOne({ name: "Employee" });
    if (!employeeRole) {
      employeeRole = await UserRole.create({
        name: "Employee",
        description: "Standard employee with default access",
      });
      console.log('Created role: "Employee"');
    } else {
      console.log('Role "Employee" already exists');
    }

    // 2. Ensure departments exist
    for (const emp of EMPLOYEE_USERS) {
      let dept = await Department.findOne({ name: emp.departmentName });
      if (!dept) {
        dept = await Department.create({
          name: emp.departmentName,
          description: `${emp.departmentName} department`,
        });
        console.log(`Created department: "${emp.departmentName}"`);
      }
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // 3. Create or update employees
    for (const emp of EMPLOYEE_USERS) {
      const email = emp.email.toLowerCase().trim();
      const department = await Department.findOne({ name: emp.departmentName });

      const existing = await User.findOne({ email });
      if (existing) {
        await User.updateOne(
          { _id: existing._id },
          {
            $set: {
              name: emp.name,
              lastName: emp.lastName,
              position: emp.position,
              role_id: employeeRole._id,
              department_id: department?._id,
              status: "Active",
              password: hashedPassword,
              mustResetPassword: false,
              loginAttempts: 0,
            },
          },
        );
        console.log(`Employee already existed, updated: ${email}`);
        continue;
      }

      await User.create({
        name: emp.name,
        lastName: emp.lastName,
        email,
        idType: "CIN",
        idNumber: {
          number: String(Math.floor(10000000 + Math.random() * 89999999)),
          countryCode: "TN",
        },
        password: hashedPassword,
        address: "Employee Address",
        joinDate: new Date(),
        phoneNumber: "+2162" + Math.floor(1000000 + Math.random() * 8999999),
        position: emp.position,
        status: "Active",
        role_id: employeeRole._id,
        department_id: department?._id,
        mustResetPassword: false,
        loginAttempts: 0,
      });

      console.log(`Created employee user: ${email}`);
    }

    console.log("\nSeeding employees completed.");
    console.log(`Default password for all employees: ${DEFAULT_PASSWORD}`);
  } catch (err) {
    console.error("Seed employees failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
}

seedEmployees();
