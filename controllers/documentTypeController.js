import * as documentTypeService from "../services/documentTypeService.js";
import { logAuditAction } from "../utils/logger.js";

// Get all the document types
export const getAllDocumentTypes = async (req, res, next) => {
  try {
    const result = await documentTypeService.getAllDocumentTypesService();
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get a document type by ID
export const getDocumentTypeById = async (req, res, next) => {
  try {
    const result = await documentTypeService.getDocumentTypeByIdService(
      req.params.id,
    );
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Add a new document type
export const addDocumentType = async (req, res, next) => {
  try {
    const result = await documentTypeService.createDocumentTypeService(
      req.body,
      req.user,
    );

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "CREATE_DOCUMENT_TYPE",
      targetType: "DocumentType",
      targetId: result.data._id,
      targetName: result.data.name,
      details: req.body,
      ipAddress: req.ip,
    });

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Update a document type
export const updateDocumentType = async (req, res, next) => {
  try {
    const result = await documentTypeService.updateDocumentTypeService(
      req.params.id,
      req.body,
      req.user,
    );

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "UPDATE_DOCUMENT_TYPE",
      targetType: "DocumentType",
      targetId: result.data._id,
      targetName: result.data.name,
      details: req.body,
      ipAddress: req.ip,
    });

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
