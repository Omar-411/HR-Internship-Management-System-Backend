// Imports
import request from "supertest";
import app from "../server.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";

// Connect to the Test Database
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI_TEST);
});

// Clean up the database before each test
beforeEach(async () => {
  await User.deleteMany({});
  await UserRole.deleteMany({});
  await Department.deleteMany({});
});
// Close DB connection after all tests
afterAll(async () => {
  await mongoose.connection.close();
});

// Helper function to create a test user
const createTestUser = async () => {
  const role = await UserRole.create({
    name: "Admin",
    description: "HR Admin Test Role",
  });

  const department = await Department.create({
    name: "HR",
    description: "Human Resources Department",
  });

  const password = "Admin123";
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name: "Admin",
    lastName: "User",
    email: "admin@example.com",
    idType: "CIN",
    idNumber: {
      number: "12145678",
      countryCode: "TN",
    },
    address: "Sousse",
    joinDate: Date.now(),
    password: hashedPassword,
    countryCode: "TN",
    phoneNumber: "97123456",
    position: "HR Admin",
    bonus: 50,
    profileImageURL: "",
    bio: "HR Admin",
    socialStatus: "Not Married",
    status: "Active",
    role_id: role._id,
    department_id: department._id,
    loginAttempts: 0,
    verificationCode: null,
    verificationCodeExpires: null,
    mustResetPassword: false,
  });

  return { user, role, password };
};

// LOGIN TESTS
describe("POST /api/login", () => {

  // Scenario 1: Successful Login
  it("Successful Login (Correct Credentials)", async () => {
    const { password } = await createTestUser();

    const res = await request(app)
      .post("/api/login")
      .send({
        email: "admin@example.com",
        password,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("Success");
    expect(res.body.result).toHaveProperty("token");
    expect(res.body.result.role).toBe("Admin");
  });

  // Scenario 2: Wrong password
  it("Failed Login (Wrong Password)", async () => {
    await createTestUser();

    const res = await request(app)
      .post("/api/login")
      .send({
        email: "admin@example.com",
        password: "wrongpassword",
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid Email or password!");
  });

  // Scenario 3: User does not exist (wrong email)
  it("Failed Login (User Not Found): Wrong Email", async () => {
    const res = await request(app)
      .post("/api/login")
      .send({
        email: "notfound@example.com",
        password: "any",
      });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("User not found!");
  });

  // Scenario 4: Account gets blocked after 3 failed attempts
  it("Blocks account after 3 failed login attempts (Wrong password 3 times)", async () => {
    await createTestUser();

    for (let i = 0; i < 3; i++) {
      await request(app)
        .post("/api/login")
        .send({
          email: "admin@example.com",
          password: "wrongpassword",
        });
    }

    const user = await User.findOne({ email: "admin@example.com" });

    expect(user.status).toBe("Blocked");
  });

  // Scenario 5: Account not verified (OTP required)
  it("Requires OTP verification if account is not active", async () => {
    const { user } = await createTestUser();

    // Un-activate the account to trigger OTP verification requirement
    user.status = "Pending";
    await user.save();

    const res = await request(app)
      .post("/api/login")
      .send({
        email: "admin@example.com",
        password: "Admin123",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("Success but OTPVerificationRequired");
  });

  // Scenario 6: Must reset password
  it("Requires password reset if mustResetPassword is true", async () => {
    const { user } = await createTestUser();

    // Trigger password reset requirement
    user.mustResetPassword = true;
    await user.save();

    const res = await request(app)
      .post("/api/login")
      .send({
        email: "admin@example.com",
        password: "Admin123",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("Success but MustResetPassword");
  });

});
