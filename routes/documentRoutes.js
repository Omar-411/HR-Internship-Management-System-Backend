import express from "express";
import {
  uploadPersonalDocument,
  deletePersonalDocument,
  downloadPersonalDocument,
  consultPersonalDocument,
  getPersonalDocuments,
  toggleConfidentiality,
  getAllAdministrativeDocuments,
  uploadAdminDocument,
  downloadAdminDocument,
  consultAdminDocument,
  deleteAdminDocument,
  fulfillDocumentRequest,
  generateDocument,
  sendGeneratedDocumentByEmail,
  getAdminDocumentsKPIsService,
} from "../controllers/documentController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { upload } from "../middleware/upload.js";
import Document from "../models/Document.js";
import AppError from "../utils/AppError.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Personal Documents
 *     description: Endpoints for the personal documents CRUDs
 */

/**
 * @swagger
 * tags:
 *   - name: Administrative Documents
 *     description: Endpoints for the administrative documents CRUDs
 */

// Route to upload a personal document (The User himself and Admin)
/**
 * @swagger
 * /api/documents/personal-doc/{id}:
 *   post:
 *     summary: Upload a personal document
 *     tags:
 *        - Personal Documents
 *     description: Allows a user to upload a personal document.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Target user ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - personalDocument
 *             properties:
 *               title:
 *                 type: string
 *                 example: Passport
 *               personalDocument:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Personal document uploaded successfully
 *       400:
 *         description: No file uploaded
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized (Admin or the user himself only)
 *       404:
 *         description: User not found | Personal Document type not found
 *       409:
 *         description: Duplicate file uploaded
 *       500:
 *         description: Server Error
 */
router.post(
  "/documents/personal-doc/:id", // :id = Target user's ID
  authenticate,
  
  upload("doc").single("personalDocument"),
  uploadPersonalDocument,
);


// Route to delete a personal document (The User himself and Admin)
/**
 * @swagger
 * /api/documents/personal-doc/{id}:
 *   delete:
 *     summary: Delete a personal document
 *     tags:
 *       - Personal Documents
 *     description: Allows a user to delete a personal document.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Document ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Personal document deleted successfully
 *       400:
 *         description: Not a personal document
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Personal document type not found | Document not found
 *       500:
 *         description: Server Error
 */
router.delete(
  "/documents/personal-doc/:id", // :id = Document's ID
  authenticate,
  
  deletePersonalDocument,
);

// Route to Download a document (Anyone with access to the user's profile and his documents)
/**
 * @swagger
 * /api/documents/personal-doc/download/{id}:
 *   get:
 *     summary: Download a personal document
 *     tags:
 *      - Personal Documents
 *     description: Allows a user to download a personal document.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Document ID
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to Cloudinary download URL
 *       400:
 *         description: Not a personal document
 *       401:
 *         description: Missing/Invalid token
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server Error
 */
router.get(
  "/documents/personal-doc/download/:id",
  authenticate,
  downloadPersonalDocument,
);

// Route to consult a document (Anyone with access to the user's profile and his documents) 
/**
 * @swagger
 * /api/documents/personal-doc/consult/{id}:
 *   get:
 *     summary: Consult a personal document
 *     tags:
 *       - Personal Documents
 *     description: Open a personal document in the browser.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Document ID
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to Cloudinary file URL
 *       400:
 *         description: Not a personal document
 *       401:
 *         description: Missing/Invalid token
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server Error
 */
router.get(
  "/documents/personal-doc/consult/:id",
  authenticate,
  consultPersonalDocument,
);

// Route to get non-confidential personal documents of a user (Special route for supervisors)
/**
 * @swagger
 * /api/documents/personal-docs/non-confidential/{id}:
 *   get:
 *     summary: Get non-confidential personal documents of a user
 *     tags:
 *      - Personal Documents
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Target user ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of non-confidential personal documents retrieved successfully
 */
router.get(
  "/documents/personal-docs/non-confidential/:id",
  authenticate,
  getPersonalDocuments,
);

// Route to get all personal documents of a user (User himself or Admin)
/**
 * @swagger
 * /api/documents/personal-docs/{id}:
 *   get:
 *     summary: Get all personal documents of a user
 *     tags:
 *      - Personal Documents
 *     description: Retrieve all personal documents of a user including.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Target user ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of personal documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: Success
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       format:
 *                         type: string
 *                       size:
 *                         type: number
 *                       fileURL:
 *                         type: string
 *                       isConfidential:
 *                         type: boolean
 */
router.get(
  "/documents/personal-docs/:id", // :id = Target user's ID
  authenticate,
  getPersonalDocuments,
);

// Route to toggle confidentiality of a personal document (The User himself and Admin)
/**
 * @swagger
 * /api/documents/personal-doc/toggle-confidentiality/:id:
 *   put:
 *     tags:
 *       - Personal Documents
 *     summary: Toggle document confidentiality (The user himself and Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document confidentiality toggled successfully
 *       400:
 *         description: Not a personal document
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
router.put(
  "/documents/personal-doc/toggle-confidentiality/:id", // :id = Document's ID
  authenticate,
  
  toggleConfidentiality,
);

// -------------------------------------------------------------- //
// --------------- ADMINISTRATIVE DOCUMENTS ROUTES -------------- //
// -------------------------------------------------------------- //

// Route to get all administrative documents (Admin only)
/**
 * @swagger
 * /api/documents/administrative-docs:
 *   get:
 *     summary: Get all administrative documents (Contracts, Reports, ...)
 *     tags:
 *      - Administrative Documents 
 *     description: Allows the admin to retrieve all administrative documents.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Target user ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of administrative documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: Success
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       format:
 *                         type: string
 *                       size:
 *                         type: number
 *                       fileURL:
 *                         type: string
 *                       isConfidential:
 *                         type: boolean
 */
router.get(
  "/documents/administrative-docs",
  authenticate,
  authorize(["Admin"]),
  getAllAdministrativeDocuments,
);

// Route to upload an administrative document (Admin only)
/**
 * @swagger
 * /api/documents/administrative-docs:
 *   post:
 *     summary: Upload an administrative document
 *     tags:
 *        - Administrative Documents
 *     description: Allows an admin to upload an administrative document.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Target user ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - administrativeDocument
 *             properties:
 *               title:
 *                 type: string
 *                 example: Passport
 *               administrativeDocument:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Administrative document uploaded successfully
 *       400:
 *         description: No file uploaded
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Document type not found
 *       409:
 *         description: Duplicate file uploaded
 *       500:
 *         description: Server Error
 */
router.post(
  "/documents/administrative-docs",
  authenticate,
  authorize(["Admin"]),
  upload("doc").single("adminDocument"),
  uploadAdminDocument
);

// Route to Download an administrative document (Admin only)
/**
 * @swagger
 * /api/documents/administrative-doc/download/{id}:
 *   get:
 *     summary: Download an administrative document
 *     tags:
 *      - Administrative Documents
 *     description: Allows an admin to download an administrative document.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Document ID
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to Cloudinary download URL
 *       400:
 *         description: Not an administrative document
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server Error
 */
router.get(
  "/documents/administrative-doc/download/:id",
  authenticate,
  authorize(["Admin"]),
  downloadAdminDocument,
);

// Route to consult an administrative document (Admin only)
/**
 * @swagger
 * /api/documents/administrative-doc/consult/{id}:
 *   get:
 *     summary: Consult an administrative document
 *     tags:
 *       - Administrative Documents
 *     description: Open an administrative document in the browser.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Document ID
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to Cloudinary file URL
 *       400:
 *         description: Not an administrative document
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server Error
 */
router.get(
  "/documents/administrative-doc/consult/:id",
  authenticate,
  authorize(["Admin"]),
  consultAdminDocument,
);

// Route to delete an administrative document (Admin only)
/**
 * @swagger
 * /api/documents/administrative-doc/{id}:
 *   delete:
 *     summary: Delete an administrative document
 *     tags:
 *       - Administrative Documents
 *     description: Allows an admin to delete an administrative document.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Document ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Administrative document deleted successfully
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server Error
 */
router.delete(
  "/documents/administrative-doc/:id",
  authenticate,
  authorize(["Admin"]),
  deleteAdminDocument,
);

// Route to get the administrative documents KPIs (Admin only)
router.get(
  "/documents/administrative-docs/kpis",
  authenticate,
  authorize(["Admin"]),
  getAdminDocumentsKPIsService,
);

// Route to generate an administrative document from a template
router.post(
  "/documents/generate/:templateName",
  authenticate,
  authorize(["Admin"]),
  generateDocument,
);

// Route to send a generated document by email
router.post(
  "/documents/send-generated/:documentId",
  authenticate,
  authorize(["Admin"]),
  sendGeneratedDocumentByEmail,
);

export default router;
