import multer from "multer";

// Memory storage for files
const storage = multer.memoryStorage();

// File size limits
const IMAGE_MAX_SIZE = 2 * 1024 * 1024;  // 2 MB for images
const DOC_MAX_SIZE = 20 * 1024 * 1024;   // 20 MB for documents

// Allowed Image/file types
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const DOC_MIME_TYPES = {
  "application/pdf": "PDF",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "image/jpeg": "Image",
  "image/png": "Image",
  "image/webp": "Image",
};

// Upload multer function per type and size limits
export const upload = (fileType) => {
  return multer({
    storage,

    fileFilter: (req, file, cb) => {  // cb = Callback function
      if (fileType === "image" && !IMAGE_MIME_TYPES.includes(file.mimetype)) {
        return cb(new Error("Only JPG, PNG or WEBP images are allowed!"));
      }
      if (fileType === "doc" && !Object.keys(DOC_MIME_TYPES).includes(file.mimetype)) {
        return cb(new Error("Only PDF, Word or Excel documents are allowed!"));
      }
      cb(null, true);
    },

    limits: { // Size limits based on the type of files (doc or image)
      fileSize: fileType === "image" ? IMAGE_MAX_SIZE : DOC_MAX_SIZE,
    },
  });
};
