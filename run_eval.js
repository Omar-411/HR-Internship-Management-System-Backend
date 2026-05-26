import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { evaluateProjectCandidatesForBackend } from './services/projectAiEvaluationService.js';
import Project from './models/Project.js';
import './models/Department.js';

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const project = await Project.findOne({ slug: 'agrisense' });
    if (!project) {
        console.log("Project not found");
        process.exit(1);
    }
    console.log("Running evaluation for", project.name);
    
    // Pass mock admin user to bypass auth
    const result = await evaluateProjectCandidatesForBackend(project._id, {
        scope: "supervisor",
        currentUser: { role: "admin" }
    });
    
    console.log("Status:", result.status);
    console.log("Message:", result.message);
    if (result.data && result.data.debugLogs) {
        console.log("Debug Logs:");
        console.log(result.data.debugLogs.join("\n"));
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
