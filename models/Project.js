import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { generateUniqueSlug } from "../utils/slugify.js";

const projectSchema = mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      default: () => nanoid(10),
    },
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    sector: {
      type: String,
      enum: [
        "Finance",
        "Education",
        "Healthcare",
        "Agriculture",
        "Transportation",
        "Tourism",
      ],
      default: "Finance",
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Planning", "Active", "Completed", "On Hold", "Archived"],
      default: "Planning",
    },
    onHoldReason: {
      type: String,
      default: null,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    productOwnerId: {
      // The supervisor
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    scrumMasterId: {
      // Can be only an employee, not an intern
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    team_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
    },
  },
  {
    timestamps: true,
  },
);

projectSchema.pre("save", async function () {
  if (!this.slug) {
    // First save only: generate slug from name
    this.slug = await generateUniqueSlug(this.constructor, this.name);
  }
  // Do NOT regenerate slug on rename. Slug is immutable after
  // first assignment to preserve URL stability.
});

export default mongoose.model("Project", projectSchema);
