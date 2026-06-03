import cloudinary from "../config/cloudinary.js";
import path from "path"; // Allows us to work with file paths and extensions

// Upload an Image to Cloudinary
export const uploadImageToCloudinary = async (fileBuffer, originalName, folder = "hrcom/profile_images") => {
  return new Promise((resolve, reject) => {
    const uploadOptions = { folder, resource_type: "image" };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });

    stream.end(fileBuffer);
  });
};

// Upload a Document to Cloudinary
export const uploadDocToCloudinary = async (fileBuffer, originalName, folder = "hrcom/docs") => {
  return new Promise((resolve, reject) => {
    if (!Buffer.isBuffer(fileBuffer)) {
      return reject(new Error("Invalid document source. Expected Buffer!"));
    }

    const uploadOptions = {
      folder,
      resource_type: "raw",
      public_id: originalName,  
      use_filename: true,
      unique_filename: false
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });

    stream.end(fileBuffer);
  });
};

// Delete a file (image or document) from Cloudinary by publicId
export const deleteFromCloudinary = async (publicId, type) => {
  if (!publicId) return;

  // Decide resource type automatically if not passed in the arguments
  const rawExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];
  const ext = path.extname(publicId).toLowerCase(); // Extract the file extension. Ex: .jpg
  const resource_type = type || (rawExtensions.includes(ext) ? "raw" : "image");

  return await cloudinary.uploader.destroy(publicId, { resource_type });
};
