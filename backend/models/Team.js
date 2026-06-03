import mongoose from "mongoose";

const teamSchema = mongoose.Schema(
  {
    name: { // Automatic : Project name + " Team"
      type: String,
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },
  },
  { 
    timestamps: true 
  },
);

export default mongoose.model("Team", teamSchema);
