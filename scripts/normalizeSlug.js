import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { nanoid } from "nanoid";
import User from "../models/User.js";
import Project from "../models/Project.js";
import { slugify } from "../utils/slugify.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });
if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true });
}

const mongoUri =
  process.env.NODE_ENV === "test"
    ? process.env.MONGO_URI_TEST
    : process.env.MONGO_URI;

const formatSlugForLog = (slug) => {
  if (slug === undefined) return "undefined";
  if (slug === null) return "null";
  if (slug === "") return "\"\"";
  return slug;
};

const matchesGeneratedSlug = (slug, baseSlug) => {
  if (!baseSlug) return false;
  if (slug === baseSlug) return true;

  const prefix = `${baseSlug}-`;
  if (!slug.startsWith(prefix)) return false;

  const suffix = slug.slice(prefix.length);
  return /^[1-9]\d*$/.test(suffix) && Number(suffix) > 1;
};

const isAcceptableExistingSlug = (rawSlug, currentSlug, baseSlug) => {
  if (typeof rawSlug !== "string" || !currentSlug) return false;
  if (rawSlug !== currentSlug) return false;
  if (currentSlug !== currentSlug.toLowerCase()) return false;
  if (slugify(currentSlug) !== currentSlug) return false;
  if (!baseSlug) return true;

  return matchesGeneratedSlug(currentSlug, baseSlug);
};

const getUniqueSlug = (baseSlug, reservedSlugs) => {
  let uniqueSlug = baseSlug;
  let counter = 1;
  let conflictCount = 0;

  while (reservedSlugs.has(uniqueSlug)) {
    counter++;
    conflictCount++;
    uniqueSlug = `${baseSlug}-${counter}`;
  }

  return { slug: uniqueSlug, conflictCount };
};

const normalizeCollection = async ({ Model, collectionName, select, getText }) => {
  const docs = await Model.find({})
    .select(select)
    .sort({ createdAt: 1, _id: 1 });

  const reservedSlugs = new Set();
  const candidates = [];

  for (const doc of docs) {
    const rawSlug = doc.slug;
    const currentSlug = typeof rawSlug === "string" ? rawSlug.trim() : "";
    const baseSlug = slugify(getText(doc));
    const record = {
      doc,
      id: doc._id.toString(),
      rawSlug,
      currentSlug,
      baseSlug,
      newSlug: "",
      conflictCount: 0,
    };

    if (isAcceptableExistingSlug(rawSlug, currentSlug, baseSlug)) {
      reservedSlugs.add(currentSlug);
    } else {
      candidates.push(record);
    }
  }

  for (const record of candidates) {
    const baseSlug = record.baseSlug || nanoid(8).toLowerCase();
    const result = getUniqueSlug(baseSlug, reservedSlugs);

    record.newSlug = result.slug;
    record.conflictCount = result.conflictCount;
    reservedSlugs.add(record.newSlug);
  }

  for (const record of candidates) {
    const temporarySlug = `slug-migration-${record.id}-TMP`;

    await Model.updateOne(
      { _id: record.doc._id },
      { $set: { slug: temporarySlug } },
      { runValidators: true },
    );
  }

  for (const record of candidates) {
    await Model.updateOne(
      { _id: record.doc._id },
      { $set: { slug: record.newSlug } },
      { runValidators: true },
    );

    console.log(
      `Updated ${collectionName} ${record.id}: ${formatSlugForLog(record.rawSlug)} → ${record.newSlug}`,
    );
  }

  return {
    updated: candidates.length,
    skipped: docs.length - candidates.length,
    conflictsResolved: candidates.reduce(
      (total, record) => total + record.conflictCount,
      0,
    ),
  };
};

const run = async () => {
  if (!mongoUri) {
    throw new Error("Missing MongoDB URI. Set MONGO_URI or MONGO_URI_TEST.");
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });

  const userSummary = await normalizeCollection({
    Model: User,
    collectionName: "users",
    select: "_id name lastName slug createdAt",
    getText: (user) => `${user.name || ""}-${user.lastName || ""}`,
  });

  const projectSummary = await normalizeCollection({
    Model: Project,
    collectionName: "projects",
    select: "_id name slug createdAt",
    getText: (project) => project.name || "",
  });

  const summary = {
    updated: userSummary.updated + projectSummary.updated,
    skipped: userSummary.skipped + projectSummary.skipped,
    conflictsResolved:
      userSummary.conflictsResolved + projectSummary.conflictsResolved,
  };

  console.log(
    `Summary: total updated ${summary.updated}, total skipped ${summary.skipped}, total conflicts resolved ${summary.conflictsResolved}`,
  );
};

run()
  .catch((err) => {
    console.error("Slug normalization failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
