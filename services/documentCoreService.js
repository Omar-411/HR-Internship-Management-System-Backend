// Core document service functions that can be used across different document types (personal, company, etc.)
import Document from "../models/Document.js";
import { pipeline } from "stream/promises";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";
import {
  uploadImageToCloudinary,
  uploadDocToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";
import { DOC_MIME_TYPES } from "../middleware/upload.js";
import { getOne, getAll } from "./handlersFactory.js";
import { fillTemplate } from "../utils/documentHelper.js";
import { CHROME_PATH } from "../constants/documentConstants.js";

// Upload a document (image or document) to Cloudinary
export const uploadDocumentCore = async (file, folderImage, folderDoc) => {
  let result;
  let format;

  // Upload an image to cloudinary
  if (file.mimetype.startsWith("image/")) {
    result = await uploadImageToCloudinary(
      file.buffer,
      file.originalname,
      folderImage,
    );
    format = file.mimetype.split("/")[1].toUpperCase();
  } else {
    // Upload a document to cloudinary
    result = await uploadDocToCloudinary(
      file.buffer,
      file.originalname,
      folderDoc,
    );
    format = DOC_MIME_TYPES[file.mimetype] || "Other";
  }

  return {
    fileURL: result.secure_url,
    filePublicId: result.public_id,
    format,
    size: file.size,
  };
};

// Delete a document from Cloudinary
export const deleteDocumentCore = async (document) => {
  let type = "raw";
  const imageFormats = ["JPEG", "PNG", "WEBP"];

  if (imageFormats.includes(document.format)) {
    type = "image";
  }

  if (document.filePublicId) {
    const result = await deleteFromCloudinary(document.filePublicId, type);
    console.log("[DELETE-PERSONAL-IMAGE] Cloudinary Deletion result:", result);
  }

  await document.deleteOne();
};

// Download a document from Cloudinary
export const downloadDocumentCore = async (document, res = null) => {
  const extMap = {
    PDF: "pdf",
    Word: "docx",
    Excel: "xlsx",
    JPEG: "jpeg",
    PNG: "png",
    WEBP: "webp",
    Other: "bin",
  };

  const baseTitle = document.title.replace(/\.[^/.]+$/, "");
  const ext = extMap[document.format] || "bin";
  const fileName = `${baseTitle}.${ext}`;

  const response = await fetch(document.fileURL);
  if (!response.ok) throw new AppError("Failed to fetch document", 500);

  // In case we want to send the document generated email
  if (!res) {
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      buffer,
      fileName,
      mimeType: response.headers.get("content-type") || "application/octet-stream",
    };
  }

  // Normal case: Download the document in the browser
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader(
    "Content-Type",
    response.headers.get("content-type") || "application/octet-stream",
  );

  await pipeline(response.body, res);
};

// Consult a document (Get the document URL for viewing): STILL NOT TESTED
export const consultDocumentCore = (document) => {
  return {
    status: "Success",
    code: 200,
    message: "Personal document URL retrieved successfully!",
    data: {
      url: document.fileURL,
    },
  };
};

// Get all documents (Generic)
export const getDocumentsCore = getAll(Document, null, "-filePublicId -__v", ["title"]);

// Generate a document from a template
export const generateDocumentCore = async (templateName, data) => {
  // Load a html template
  const templatePath = path.join(
    process.cwd(),
    "templates",
    `${templateName}.html`
  );

  let html = fs.readFileSync(templatePath, "utf-8");

  // Fill template
  html = fillTemplate(html, data);

  // Launch browser
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const page = await browser.newPage();

  // Set the HTML content of the page to the filled template and wait until all network requests are finished
  await page.setContent(html, { waitUntil: "networkidle0" }); 

  // Generate the PDF template 
  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });

  const pdfBuffer = Buffer.from(pdf);

  await browser.close();
  return pdfBuffer;
};
