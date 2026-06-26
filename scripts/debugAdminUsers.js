import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function checkAdminUsers() {
  await mongoose.connect(MONGO_URI);
  const users = await mongoose.connection.db.collection("users").find({
    email: { $in: [
      "omar@dotjcom.com",
      "yassine.admin@dotjcom.com",
      "siwar.it@dotjcom.com",
      "siwar.finance@dotjcom.com"
    ] }
  }).toArray();
  for (const u of users) {
    console.log({
      email: u.email,
      status: u.status,
      mustResetPassword: u.mustResetPassword,
      loginAttempts: u.loginAttempts,
      password: u.password,
      role_id: u.role_id
    });
  }
  await mongoose.disconnect();
}

checkAdminUsers();
