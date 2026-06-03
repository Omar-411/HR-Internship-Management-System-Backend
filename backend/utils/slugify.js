import { nanoid } from "nanoid";

export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-"); // Replace multiple - with single -
}

export async function generateUniqueSlug(model, text, field = "slug") {
  let slug = slugify(text);
  if (!slug) slug = nanoid(8).toLowerCase();

  let uniqueSlug = slug;
  let counter = 1;

  while (await model.findOne({ [field]: uniqueSlug })) {
    counter++;
    uniqueSlug = `${slug}-${counter}`;
  }

  return uniqueSlug;
}
