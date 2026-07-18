// One-off reset: drops the whole database, then seeds only the user roles
// and a single Admin account. Run from server/: node scratch/resetDb.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import connectMongo from "../config/db.js";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";

const rolesToSeed = [
  { name: "Admin", description: "Full access to the platform" },
  { name: "Supervisor", description: "Manages a team and approves requests" },
  { name: "Employee", description: "Regular employee" },
  { name: "Intern", description: "Intern with limited access" },
];

const run = async () => {
  await connectMongo();

  const dbName = mongoose.connection.db.databaseName;
  await mongoose.connection.db.dropDatabase();
  console.log(`Dropped database: ${dbName}`);

  const roles = {};
  for (const role of rolesToSeed) {
    roles[role.name] = await UserRole.create(role);
    console.log(`Created role: ${role.name}`);
  }

  const hashedPassword = await bcrypt.hash("Password123!", 10);
  const admin = await User.create({
    name: "Omar",
    lastName: "Ajimi",
    gender: "Male",
    email: "ajimiomar.oa@gmail.com",
    dateOfBirth: new Date("1995-01-01"),
    placeOfBirth: "Tunis",
    idType: "CIN",
    idNumber: {
      number: "00000001",
      countryCode: "TN",
      issueDate: new Date("2015-01-01"),
      issuePlace: "Tunis",
    },
    address: "Tunis",
    phoneNumber: "+21620000000",
    position: "Admin",
    employment: {
      contractType: "CDI",
      contractJoinDate: new Date(),
      contractEndDate: null,
    },
    salary: { base: 0, currency: "DT" },
    role_id: roles.Admin._id,
    password: hashedPassword,
    status: "Active",
    mustResetPassword: false,
  });
  console.log(`Created admin user: ${admin.email}`);

  await mongoose.disconnect();
  console.log("Done.");
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
