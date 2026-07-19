/**
 * Seed script: creates an "Admin" role and five admin users for testing.
 * Run from server folder: node scripts/seedAdmin.js
 * Reset existing admin passwords: node scripts/seedAdmin.js --force-reset-password
 *
 * Default test admins (all share the same password):
 *   - omar@dotjcom.com
 *   - yassine.admin@dotjcom.com
 *   - siwar.it@dotjcom.com
 *   - siwar.finance@dotjcom.com
 *   - ghayth.khezami@dotjcom.com
 *   Password: Admin123!
 *
 * Safe to run multiple times: it will create missing admins and optionally reset passwords.
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";

dotenv.config();

const ADMIN_PASSWORD = "Admin123!";
const FORCE_RESET_PASSWORD = process.argv.includes("--force-reset-password");

const ADMIN_USERS = [
  {
    name: "Omar",
    lastName: "Ajimi",
    email: "omar@dotjcom.com",
    position: "Administrator",
    idNumber: "00000000",
    phoneNumber: "+1234567890",
    gender: "Male",
  },
  {
    name: "Yassine",
    lastName: "Janhani",
    email: "yassine.admin@dotjcom.com",
    position: "HR Administrator",
    idNumber: "00000001",
    phoneNumber: "+1234567891",
    gender: "Male",
  },
  {
    name: "Siwar",
    lastName: "Bouhalwen",
    email: "siwar.it@dotjcom.com",
    position: "IT Administrator",
    idNumber: "00000002",
    phoneNumber: "+1234567892",
    gender: "Female",
  },
  {
    name: "Siwar",
    lastName: "Bensalem",
    email: "siwar.finance@dotjcom.com",
    position: "Finance Administrator",
    idNumber: "00000003",
    phoneNumber: "+1234567893",
    gender: "Female",
  },
  {
    name: "Ghayth",
    lastName: "Khezami",
    email: "ghayth.khezami@dotjcom.com",
    position: "Administrator",
    idNumber: "00000004",
    phoneNumber: "+1234567894",
    gender: "Male",
  },
];

async function seedAdmin() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/HR-DOTJCOM";
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected.\n");

  try {
    // 1. Create "Admin" role if it doesn't exist
    let adminRole = await UserRole.findOne({ name: "Admin" });
    if (!adminRole) {
      adminRole = await UserRole.create({
        name: "Admin",
        description: "Administrator with full access",
      });
      console.log('Created role: "Admin"');
    } else {
      console.log('Role "Admin" already exists');
    }

    // 2. Create or update each admin user
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // Check for duplicate emails in ADMIN_USERS
    const emails = ADMIN_USERS.map(a => a.email.toLowerCase().trim());
    const duplicates = emails.filter((email, idx) => emails.indexOf(email) !== idx);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate emails found in ADMIN_USERS: ${[...new Set(duplicates)].join(', ')}`);
    }

    for (const admin of ADMIN_USERS) {
      const email = admin.email.toLowerCase().trim();

      const existingAdmin = await User.findOne({ email });
      if (existingAdmin) {
        const existingRole = await UserRole.findById(existingAdmin.role_id);
        if (existingRole?.name === "Admin") {
          if (FORCE_RESET_PASSWORD) {
            await User.updateOne(
              { _id: existingAdmin._id },
              {
                $set: {
                  password: hashedPassword,
                  status: "Active",
                  mustResetPassword: false,
                  loginAttempts: 0,
                },
              },
            );
            console.log(`Admin user already exists, password reset: ${email}`);
          } else {
            console.log(`Admin user already exists: ${email}`);
          }
          continue;
        }

        console.log(
          `User ${email} already exists with another role. Skipping; change the email in seedAdmin.js if you want this user to be Admin.`,
        );
        continue;
      }

      const now = new Date();
      const contractEnd = new Date(now);
      contractEnd.setFullYear(contractEnd.getFullYear() + 2);

      await User.create({
        name: admin.name,
        lastName: admin.lastName,
        email,
        gender: admin.gender,
        dateOfBirth: new Date("1995-01-01"),
        placeOfBirth: "Tunis",
        idType: "CIN",
        idNumber: {
          number: admin.idNumber,
          countryCode: "TN",
          issueDate: new Date("2015-01-01"),
          issuePlace: "Tunis",
        },
        password: hashedPassword,
        address: "Seed Address",
        joinDate: now,
        employment: {
          contractJoinDate: now,
          contractEndDate: contractEnd,
        },
        phoneNumber: admin.phoneNumber,
        position: admin.position,
        status: "Active",
        role_id: adminRole._id,
        mustResetPassword: false, // so you can log in immediately for testing
      });
      console.log(`Created admin user: ${email}`);
    }

    console.log("\nAdmin seeding complete.");
    console.log(`Default password for all admins: ${ADMIN_PASSWORD}`);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
