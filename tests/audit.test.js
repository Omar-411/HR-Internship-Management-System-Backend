// Load .env.test (Cloudinary keys for the UPLOAD_IMAGE log)
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

jest.mock("../utils/cloudinaryHelper.js", () => ({
  uploadImageToCloudinary: jest.fn().mockResolvedValue({
    secure_url: "http://mock-url.com/image.png",
    public_id: "mock-image-id",
  }),
  uploadDocToCloudinary: jest.fn().mockResolvedValue({
    secure_url: "http://mock-url.com/cv.pdf",
    public_id: "mock-cv-id",
  }),
  deleteFromCloudinary: jest.fn().mockResolvedValue({}),
}));

import request from "supertest";
import app from "../server.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";
import AuditLog from "../models/AuditLog.js";

// Connect to test database
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI_TEST);
});

// Clean database before each test
beforeEach(async () => {
  await User.deleteMany({});
  await UserRole.deleteMany({});
  await Department.deleteMany({});
  await AuditLog.deleteMany({});
});

// Close connection after tests
afterAll(async () => {
  await mongoose.connection.close();
});

// Helper function to create an employee
const createEmployee = async () => {
  const role = await UserRole.create({
    name: "Employee",
    description: "Employee Test Role",
  });

  const department = await Department.create({
    name: "IT",
    description: "Information Technology Department",
  });

  const hashedPassword = await bcrypt.hash("Employee123", 10);

  const user = await User.create({
    name: "New",
    lastName: "Employee",
    email: "employee@example.com",
    gender: "Male",
    dateOfBirth: new Date("1995-01-01"),
    placeOfBirth: "Tunis",
    idType: "CIN",
    idNumber: {
      number: "12345678",
      countryCode: "TN",
      issueDate: new Date("2020-01-01"),
      issuePlace: "Tunis",
    },
    address: "Sousse",
    joinDate: Date.now(),
    password: hashedPassword,
    countryCode: "TN",
    phoneNumber: "97123456",
    position: "Developer",
    bonus: 50,
    profileImageURL: "",
    bio: "Developer in IT Department",
    socialStatus: "Not Married",
    status: "Active",
    role_id: role._id,
    department_id: department._id,
    loginAttempts: 0,
    verificationCode: null,
    verificationCodeExpires: null,
    mustResetPassword: false,
    employment: {
      contractType: "CDI",
      contractJoinDate: new Date("2024-01-01"),
    },
  });

  return user;
};

// AUDIT LOG TESTS
describe("Audit Logging Tests", () => {
  let adminToken;
  let adminUser;

  beforeEach(async () => {
    // Create Admin Role
    const adminRole = await UserRole.create({
      name: "Admin",
      description: "HR Admin Test Role",
    });

    // Create Department
    const department = await Department.create({
      name: "HR",
      description: "Human Resources Department",
    });

    const hashedPassword = await bcrypt.hash("Admin123", 10);

    // Create Admin User
    adminUser = await User.create({
      name: "Admin",
      lastName: "User",
      email: "admin@test.com",
      gender: "Male",
      dateOfBirth: new Date("1995-01-01"),
      placeOfBirth: "Tunis",
      idType: "CIN",
      idNumber: {
        number: "012365478",
        countryCode: "TN",
        issueDate: new Date("2020-01-01"),
        issuePlace: "Tunis",
      },
      address: "Test City",
      joinDate: Date.now(),
      password: hashedPassword,
      countryCode: "TN",
      phoneNumber: "96123456",
      position: "HR Admin",
      bonus: 50,
      profileImageURL: "",
      bio: "HR Admin",
      socialStatus: "Not Married",
      status: "Active",
      role_id: adminRole._id,
      department_id: department._id,
      loginAttempts: 0,
      verificationCode: null,
      verificationCodeExpires: null,
      mustResetPassword: false,
      employment: {
        contractType: "CDI",
        contractJoinDate: new Date("2024-01-01"),
      },
    });

    // Generate JWT
    adminToken = jwt.sign(
      { id: adminUser._id, role: "Admin" },
      process.env.JWT_SECRET,
    );
  });

  // SCENARIO1: CREATE USER AUDIT LOG
  it("Should create an audit log entry when a user is created", async () => {
    await UserRole.create({
      name: "Employee",
      description: "Employee Role",
    });

    await Department.create({
      name: "IT",
      description: "Information Technology Department",
    });

    const cvBuffer = Buffer.from("%PDF-1.4 dummy pdf content");
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .field("name", "New")
      .field("lastName", "Employee")
      .field("email", "employee@test.com")
      .field("gender", "Male")
      .field("dateOfBirth", "1995-01-01")
      .field("placeOfBirth", "Tunis")
      .field("idType", "CIN")
      .field("idCountryCode", "TN")
      .field("idNumber", "12145678")
      .field("issueDate", "2020-01-01")
      .field("issuePlace", "Tunis")
      .field("address", "Work City")
      .field("countryCode", "TN")
      .field("phoneNumber", "97123456")
      .field("position", "Developer")
      .field("role", "Employee")
      .field("department", "IT")
      .field("contractType", "CDI")
      .field("contractJoinDate", "2024-01-01")
      .attach("cv", cvBuffer, { filename: "cv.pdf", contentType: "application/pdf" });

    if (res.statusCode !== 201) {
      console.log("Create User Error:", res.body);
    }

    expect(res.statusCode).toBe(201);

    const log = await AuditLog.findOne({ action: "CREATE_USER" });

    expect(log).not.toBeNull();
    expect(log.admin_id.toString()).toBe(adminUser._id.toString());
    expect(log.target_type).toBe("User");
    expect(log.target_name).toBe("New Employee");
  }, 15000);

  // SCENARIO2: DELETE USER AUDIT LOG
  it("Should create an audit log entry when a user is deleted", async () => {
    const user = await createEmployee();

    const res = await request(app)
      .delete(`/api/users/${user._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.statusCode !== 200) {
      console.log("Delete User Error:", res.body);
    }

    expect(res.statusCode).toBe(200);

    const log = await AuditLog.findOne({ action: "DELETE_USER" });

    expect(log).not.toBeNull();
    expect(log.target_id.toString()).toBe(user._id.toString());
    expect(log.target_name).toBe("New Employee");
  });

  // SCENARIO3: UPDATE USER AUDIT LOG
  it("Should create an audit log entry when a user is updated", async () => {
    // Create Employee
    const user = await createEmployee();

    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ position: "Senior Developer" });

    if (res.statusCode !== 200) {
      console.log("Update User Error:", res.body);
    }

    expect(res.statusCode).toBe(200);

    const log = await AuditLog.findOne({ action: "UPDATE_USER" });

    expect(log).not.toBeNull();
    expect(log.target_id.toString()).toBe(user._id.toString());
    expect(log.target_name).toBe("New Employee");
    expect(log.details).toMatchObject({
      position: "Senior Developer",
    });
  });

  // SCENARIO4: TOGGLE_STATUS AUDIT LOG
  it("Should create an audit log entry when a user's status is toggled", async () => {
    // Create Employee
    const user = await createEmployee();

    const res = await request(app)
      .put(`/api/users/${user._id}/toggle-status`)
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.statusCode !== 200) {
      console.log("Toggle Status Error:", res.body);
    }

    expect(res.statusCode).toBe(200);

    const log = await AuditLog.findOne({ action: "TOGGLE_STATUS" });

    expect(log).not.toBeNull();
    expect(log.target_id.toString()).toBe(user._id.toString());
    expect(log.target_name).toBe("New Employee");
    expect(log.details).toMatchObject({
      status: "Inactive",
    });
  });

  // SCENARIO5: UPLOAD_IMAGE AUDIT LOG
  it("Should create an audit log entry when a user's profile image is uploaded", async () => {
    // Create Employee
    const user = await createEmployee();

    const imageBuffer = Buffer.from("fake image content");
    const res = await request(app)
      .post(`/api/users/${user._id}/profile-image`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("profileImage", imageBuffer, { filename: "Me2.png", contentType: "image/png" });

    if (res.statusCode !== 200) {
      console.log("Upload Image Error:", res.body);
    }
    expect(res.statusCode).toBe(200);

    const log = await AuditLog.findOne({ action: "UPLOAD_IMAGE" });

    expect(log).not.toBeNull();
    expect(log.target_id.toString()).toBe(user._id.toString());
    expect(log.target_name).toBe("New Employee");
  }, 15000);

  // SCENARIO6: REMOVE_IMAGE AUDIT LOG
  it("Should create an audit log entry when a user's profile image is removed", async () => {
    // Create Employee
    const user = await createEmployee();

    // Upload an image to the user
    const imageBuffer = Buffer.from("fake image content");
    await request(app)
      .post(`/api/users/${user._id}/profile-image`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("profileImage", imageBuffer, { filename: "Me2.png", contentType: "image/png" });

    // Remove the image
    const res = await request(app)
      .delete(`/api/users/${user._id}/profile-image`)
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.statusCode !== 200) {
      console.log("Remove Image Error:", res.body);
    }

    expect(res.statusCode).toBe(200);

    const log = await AuditLog.findOne({ action: "REMOVE_IMAGE" });

    expect(log).not.toBeNull();
    expect(log.target_id.toString()).toBe(user._id.toString());
    expect(log.target_name).toBe("New Employee");
  }, 15000);

  // SCENARIO7: CREATE_ROLE AUDIT LOG
  it("Should create an audit log entry when a role is created", async () => {
    const newRole = {
      name: "Intern",
      description: "Intern Role",
    };

    const res = await request(app)
      .post("/api/roles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(newRole);

    if (res.statusCode !== 201) {
      console.log("Create Role Error:", res.body);
    }

    expect(res.statusCode).toBe(201);

    const log = await AuditLog.findOne({ action: "CREATE_ROLE" });

    expect(log).not.toBeNull();
    expect(log.admin_id.toString()).toBe(adminUser._id.toString());
    expect(log.target_type).toBe("UserRole");
    expect(log.target_name).toBe("Intern");
  });

  // SCENARIO8: DELETE_ROLE AUDIT LOG
  it("Should create an audit log entry when a role is deleted", async () => {
    const role = await UserRole.create({
      name: "TempRole",
      description: "Temporary Role",
    });

    const res = await request(app)
      .delete(`/api/roles/${role._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.statusCode !== 200) {
      console.log("Delete Role Error:", res.body);
    }

    expect(res.statusCode).toBe(200);

    const log = await AuditLog.findOne({ action: "DELETE_ROLE" });

    expect(log).not.toBeNull();
    expect(log.admin_id.toString()).toBe(adminUser._id.toString());
    expect(log.target_type).toBe("UserRole");
    expect(log.target_name).toBe("TempRole");
  });

  // SCENARIO9: UPDATE_ROLE AUDIT LOG
  it("Should create an audit log entry when a role is updated", async () => {
    const newRole = {
      name: "Intern",
      description: "Intern Role",
    };

    const savedRole = await UserRole.create(newRole);

    const res = await request(app)
      .put(`/api/roles/${savedRole._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "INTERN" });

    if (res.statusCode !== 200) {
      console.log("Update Role Error:", res.body);
    }

    expect(res.statusCode).toBe(200);

    const log = await AuditLog.findOne({ action: "UPDATE_ROLE" });

    expect(log).not.toBeNull();
    expect(log.admin_id.toString()).toBe(adminUser._id.toString());
    expect(log.target_type).toBe("UserRole");
    expect(log.target_name).toBe("INTERN");
    expect(log.details).toMatchObject({
      name: "INTERN",
    });
  });

  // SCENARIO10: CREATE_DEPARTMENT AUDIT LOG
  it("Should create an audit log entry when a department is created", async () => {
    const newDept = {
      name: "Law",
      description: "Law Department",
    };

    const res = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(newDept);

    if (res.statusCode !== 201) {
      console.log("Create Department Error:", res.body);
    }

    expect(res.statusCode).toBe(201);

    const log = await AuditLog.findOne({ action: "CREATE_DEPARTMENT" });

    expect(log).not.toBeNull();
    expect(log.admin_id.toString()).toBe(adminUser._id.toString());
    expect(log.target_type).toBe("Department");
    expect(log.target_name).toBe("Law");
  });

  // SCENARIO11: DELETE_DEPARTMENT AUDIT LOG
  it("Should create an audit log entry when a department is deleted", async () => {
    const dept = await Department.create({
      name: "TempDept",
      description: "Temporary Department",
    });

    const res = await request(app)
      .delete(`/api/departments/${dept._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.statusCode !== 200) {
      console.log("Delete Department Error:", res.body);
    }

    expect(res.statusCode).toBe(200);

    const log = await AuditLog.findOne({ action: "DELETE_DEPARTMENT" });

    expect(log).not.toBeNull();
    expect(log.admin_id.toString()).toBe(adminUser._id.toString());
    expect(log.target_type).toBe("Department");
    expect(log.target_name).toBe("TempDept");
  });

  // SCENARIO12: UPDATE_DEPARTMENT AUDIT LOG
  it("Should create an audit log entry when a department is updated", async () => {
    const newDept = {
      name: "Law",
      description: "Law Department",
    };

    const savedDept = await Department.create(newDept);

    const res = await request(app)
      .put(`/api/departments/${savedDept._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "LAW" });

    if (res.statusCode !== 200) {
      console.log("Update Department Error:", res.body);
    }

    expect(res.statusCode).toBe(200);

    const log = await AuditLog.findOne({ action: "UPDATE_DEPARTMENT" });

    expect(log).not.toBeNull();
    expect(log.admin_id.toString()).toBe(adminUser._id.toString());
    expect(log.target_type).toBe("Department");
    expect(log.target_name).toBe("LAW");
    expect(log.details).toMatchObject({
      name: "LAW",
    });
  });
});
