import express from "express";
import {
  addDocumentType,
  getAllDocumentTypes,
  getDocumentTypeById,
  updateDocumentType,
} from "../controllers/documentTypeController.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Document Types
 *     description: Endpoints for the document types CRUDs
 */

// Route to add a new document type (Admin only)
/**
 * @swagger
 * /api/document-types:
 *   post:
 *     summary: Add a new document type
 *     tags: 
 *        - Document Types
 *     security:
 *       - bearerAuth: []
 *     description: Allows an Admin to create a new document type.
 *     requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - name
 *               properties:
 *                 name:
 *                   type: string
 *                   example: Personal
 *                 description:
 *                   type: string
 *                   example: Personal documents uploaded by users
 *     responses:
 *       201:
 *         description: Document type added successfully
 *       400:
 *         description: Name field empty
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       409:
 *         description: Document type already exists
 *       500:
 *         description: Server Error
 */
router.post(
  "/document-types",
  authenticate,
  authorize(["Admin"]),
  addDocumentType,
);

// Route to get all document types (Admin only)
/**
 * @swagger
 * /api/document-types:
 *   get:
 *     summary: Get all document types
 *     tags: 
 *        - Document Types
 *     security:
 *       - bearerAuth: []
 *     description: Allows an admin to retrieve all document types.
 *     responses:
 *       200:
 *         description: Retrieved the list of document types
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: Success
 *                 data:
 *                   type: object
 *                   properties:
 *                     documentTypes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/DocumentType'
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       500:  
 *         description: Server Error
 */
router.get(
  "/document-types",
  authenticate,
  authorize(["Admin"]),
  getAllDocumentTypes,
);

// Route to get a specific document type by ID (Admin only)
/**
 * @swagger
 * /api/document-types/{id}:
 *   get:
 *     summary: Get a document type by ID
 *     tags: 
 *        - Document Types
 *     security:
 *       - bearerAuth: []
 *     description: Allows an admin to retrieve a specific document type by its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Document type ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document type details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: Success
 *                 data:
 *                   type: object
 *                   properties:
 *                     documentType:
 *                       $ref: '#/components/schemas/DocumentType'
 *       404:
 *         description: Document type not found
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       500:  
 *         description: Server Error
 */
router.get(
  "/document-types/:id",
  authenticate,
  authorize(["Admin"]),
  getDocumentTypeById,
);

// Route to update a specific document type by ID (Admin only)
/**
 * @swagger
 * /api/document-types/{id}:
 *   put:
 *     summary: Update a document type
 *     tags: 
 *        - Document Types
 *     security:
 *       - bearerAuth: []
 *     description: Allows an admin to update a document type by ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Document type ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Contract
 *               description:
 *                 type: string
 *                 example: Employment contracts
 *     responses:
 *       200:
 *         description: Document type updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: Success
 *                 message:
 *                   type: string
 *                   example: Document type updated successfully!
 *                 data:
 *                   type: object
 *                   properties:
 *                     documentType:
 *                       $ref: '#/components/schemas/DocumentType'
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Document type not found
 *       401:
 *         description: Missing/Invalid token
 *       403:
 *         description: Unauthorized
 *       409:
 *         description: Document type already exists
 *       500:
 *         description: Server Error
 */
router.put(
  "/document-types/:id",
  authenticate,
  authorize(["Admin"]),
  updateDocumentType,
);

export default router;
