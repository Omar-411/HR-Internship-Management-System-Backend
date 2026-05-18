import mongoose from "mongoose";

/**
 * Resolves a public identifier (slug, publicId, or MongoDB _id) into a database query object.
 * @param {string} id - The identifier to resolve.
 * @returns {Object} - A MongoDB query object, e.g., { _id: ... } or { slug: ... } or { publicId: ... }
 */
export const resolveId = (id) => {
  if (!id) return {};

  const idStr = id.toString().trim();
  const normalizedStr = idStr.toLowerCase();

  return {
    $or: [
      { slug: normalizedStr },
      { publicId: idStr },
      ...(idStr.match(/^[a-f\d]{24}$/i) ? [{ _id: idStr }] : [])
    ]
  };
};
