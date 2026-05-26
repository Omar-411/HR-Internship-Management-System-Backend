import mongoose from "mongoose";
import dotenv from "dotenv";
import connectMongo from "../config/db.js";
import DocumentType from "../models/DocumentType.js";

dotenv.config();

const typesToSeed = [
  { name: "Certificate", description: "Official company certificates (e.g. Employment, Internship, Recommendation)" },
  { name: "Contract", description: "Legal employee contracts (e.g. CDI, CDD, Internship Contract)" },
  { name: "Report", description: "Monthly reports and payslips" }
];

const run = async () => {
  await connectMongo();
  
  for (const type of typesToSeed) {
    const existing = await DocumentType.findOne({ name: type.name });
    if (!existing) {
      await DocumentType.create(type);
      console.log(`Created document type: ${type.name}`);
    } else {
      console.log(`Document type ${type.name} already exists.`);
    }
  }

  const allTypes = await DocumentType.find({});
  console.log("=== ALL CURRENT DOCUMENT TYPES IN DB ===");
  console.log(allTypes.map(t => ({ id: t._id, name: t.name })));
  
  mongoose.connection.close();
};

run().catch(console.error);
