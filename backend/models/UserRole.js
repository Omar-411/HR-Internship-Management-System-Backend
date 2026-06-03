import mongoose from "mongoose";

const userRoleSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    }
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("UserRole", userRoleSchema);
 