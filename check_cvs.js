import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import User from './models/User.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({ name: { $in: ['Mateo', 'Elias', 'Hanen', 'Yassine', 'Julian', 'André'] } });
  for (const user of users) {
    console.log(user.name, user.lastName, 'cvURL:', user.cvURL);
  }
  process.exit(0);
}
run();
