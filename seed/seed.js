import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import connectMongo from "../config/db.js";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";
import Timetable from "../models/Timetable.js";
import PayrollConfig from "../models/PayrollConfig.js";
import { SHIFT_CONFIG } from "../constants/timetableConstants.js";

dotenv.config();

const DEFAULT_PASSWORD = "Password123!";

const rolesToSeed = [
  { name: "Admin", description: "Full access to the platform" },
  { name: "Supervisor", description: "Manages a team and approves requests" },
  { name: "Employee", description: "Regular employee" },
  { name: "Intern", description: "Intern with limited access" },
];

const departmentsToSeed = [
  { name: "Human Resources", description: "HR department" },
  { name: "Engineering", description: "Software engineering department" },
];

const seedRoles = async () => {
  const roles = {};
  for (const role of rolesToSeed) {
    let doc = await UserRole.findOne({ name: role.name });
    if (!doc) {
      doc = await UserRole.create(role);
      console.log(`Created role: ${role.name}`);
    }
    roles[role.name] = doc;
  }
  return roles;
};

const seedDepartments = async () => {
  const departments = {};
  for (const dep of departmentsToSeed) {
    let doc = await Department.findOne({ name: dep.name });
    if (!doc) {
      doc = await Department.create(dep);
      console.log(`Created department: ${dep.name}`);
    }
    departments[dep.name] = doc;
  }
  return departments;
};

const buildUsers = (roles, departments) => [
  {
    name: "Amine",
    lastName: "Ben Salah",
    gender: "Male",
    email: "admin@hr.local",
    dateOfBirth: new Date("1985-03-12"),
    placeOfBirth: "Tunis",
    idType: "CIN",
    idNumber: {
      number: "10000001",
      countryCode: "TN",
      issueDate: new Date("2015-01-10"),
      issuePlace: "Tunis",
    },
    address: "12 Avenue Habib Bourguiba, Tunis",
    phoneNumber: "+21620100001",
    position: "HR Manager",
    employment: {
      contractType: "CDI",
      contractJoinDate: new Date("2020-01-01"),
      contractEndDate: null,
    },
    salary: { base: 5500, currency: "DT" },
    role_id: roles.Admin._id,
    department_id: departments["Human Resources"]._id,
  },
  {
    name: "Sonia",
    lastName: "Trabelsi",
    gender: "Female",
    email: "supervisor@hr.local",
    dateOfBirth: new Date("1988-07-25"),
    placeOfBirth: "Sfax",
    idType: "CIN",
    idNumber: {
      number: "10000002",
      countryCode: "TN",
      issueDate: new Date("2016-05-20"),
      issuePlace: "Sfax",
    },
    address: "5 Rue de la Liberté, Sfax",
    phoneNumber: "+21620100002",
    position: "Engineering Team Lead",
    employment: {
      contractType: "CDI",
      contractJoinDate: new Date("2021-03-01"),
      contractEndDate: null,
    },
    salary: { base: 3500, currency: "DT" },
    role_id: roles.Supervisor._id,
    department_id: departments.Engineering._id,
  },
  {
    name: "Karim",
    lastName: "Gharbi",
    gender: "Male",
    email: "employee1@hr.local",
    dateOfBirth: new Date("1995-11-02"),
    placeOfBirth: "Sousse",
    idType: "CIN",
    idNumber: {
      number: "10000003",
      countryCode: "TN",
      issueDate: new Date("2018-09-15"),
      issuePlace: "Sousse",
    },
    address: "8 Rue Ibn Khaldoun, Sousse",
    phoneNumber: "+21620100003",
    position: "Software Engineer",
    employment: {
      contractType: "CDI",
      contractJoinDate: new Date("2022-06-01"),
      contractEndDate: null,
    },
    salary: { base: 1800, currency: "DT" },
    role_id: roles.Employee._id,
    department_id: departments.Engineering._id,
    supervisorEmail: "supervisor@hr.local",
  },
  {
    name: "Mariem",
    lastName: "Jlassi",
    gender: "Female",
    email: "employee2@hr.local",
    dateOfBirth: new Date("1997-02-18"),
    placeOfBirth: "Bizerte",
    idType: "CIN",
    idNumber: {
      number: "10000004",
      countryCode: "TN",
      issueDate: new Date("2019-04-08"),
      issuePlace: "Bizerte",
    },
    address: "3 Avenue de Carthage, Bizerte",
    phoneNumber: "+21620100004",
    position: "QA Engineer",
    employment: {
      contractType: "CDD",
      contractJoinDate: new Date("2024-01-15"),
      contractEndDate: new Date("2026-12-31"),
    },
    salary: { base: 1800, currency: "DT" },
    role_id: roles.Employee._id,
    department_id: departments.Engineering._id,
    supervisorEmail: "supervisor@hr.local",
  },
  {
    name: "Yassine",
    lastName: "Mansouri",
    gender: "Male",
    email: "intern@hr.local",
    dateOfBirth: new Date("2002-09-30"),
    placeOfBirth: "Tunis",
    idType: "CIN",
    idNumber: {
      number: "10000005",
      countryCode: "TN",
      issueDate: new Date("2021-07-12"),
      issuePlace: "Tunis",
    },
    address: "22 Rue de Marseille, Tunis",
    phoneNumber: "+21620100005",
    position: "Software Engineering Intern",
    employment: {
      contractType: "INTERNSHIP",
      contractJoinDate: new Date("2026-02-01"),
      contractEndDate: new Date("2026-08-01"),
    },
    salary: { base: 600, currency: "DT" },
    role_id: roles.Intern._id,
    department_id: departments.Engineering._id,
    supervisorEmail: "supervisor@hr.local",
  },
];

const seedUsers = async (roles, departments) => {
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const created = [];

  for (const userData of buildUsers(roles, departments)) {
    const { supervisorEmail, ...data } = userData;

    const existing = await User.findOne({ email: data.email });
    if (existing) {
      console.log(`User ${data.email} already exists, skipping.`);
      continue;
    }

    if (supervisorEmail) {
      const supervisor = await User.findOne({ email: supervisorEmail });
      data.supervisor_id = supervisor ? supervisor._id : null;
    }

    const user = await User.create({
      ...data,
      password: hashedPassword,
      status: "Active",
      mustResetPassword: false,
    });
    created.push(user.email);
    console.log(`Created user: ${user.email} (${user.position})`);
  }

  return created;
};

// Seed timetables for all seeded users: weekday full-time shifts, weekend days off,
// from 7 days ago to 21 days ahead. Upserts on (userId, date) so it is idempotent.
const seedTimetablesFor = async (roles, departments) => {
  const emails = buildUsers(roles, departments).map((u) => u.email);
  const users = await User.find({ email: { $in: emails } }).select("_id email");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let upserted = 0;
  for (const user of users) {
    for (let offset = -7; offset <= 21; offset++) {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() + offset);

      const day = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = day === 0 || day === 6;
      const type = isWeekend ? "Day Off" : "Full-time Shift";

      const update = isWeekend
        ? { type, startTime: undefined, endTime: undefined, location: undefined }
        : {
            type,
            startTime: SHIFT_CONFIG[type].startTime,
            endTime: SHIFT_CONFIG[type].endTime,
            location: "Onsite",
          };

      const result = await Timetable.updateOne(
        { userId: user._id, date },
        { $setOnInsert: { userId: user._id, date }, $set: update },
        { upsert: true, runValidators: true },
      );
      if (result.upsertedCount > 0) upserted++;
    }
  }
  console.log(`Timetables: ${upserted} new shift(s) created for ${users.length} user(s).`);
};

// Seed an active payroll configuration for the current year (schema defaults
// already hold the standard Tunisian rates: CNSS, CSS, IRPP brackets, etc.)
const seedPayrollConfig = async () => {
  const year = new Date().getFullYear();
  const existing = await PayrollConfig.findOne({ year, isActive: true });
  if (existing) {
    console.log(`Active payroll config for ${year} already exists.`);
    return;
  }
  await PayrollConfig.create({ year, isActive: true });
  console.log(`Created active payroll config for ${year} (default rates).`);
};

const run = async () => {
  await connectMongo();

  const roles = await seedRoles();
  const departments = await seedDepartments();
  const created = await seedUsers(roles, departments);
  await seedTimetablesFor(roles, departments);
  await seedPayrollConfig();

  console.log("\n=== SEED COMPLETE ===");
  if (created.length > 0) {
    console.log(`Created ${created.length} user(s). Default password: ${DEFAULT_PASSWORD}`);
  } else {
    console.log("No new users created.");
  }

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.connection.close();
  process.exit(1);
});
