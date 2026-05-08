import * as documentService from "../services/documentService.js";

// ------------------------------------------------------------------------------- //
// ------------------------ PERSONAL DOCUMENTS CONTROLLERS ----------------------- //
// ------------------------------------------------------------------------------- //

// Upload a personal document controller
export const uploadPersonalDocument = async (req, res, next) => {
  try {
    const result = await documentService.uploadPersonalDocumentService({
      targetUserId: req.params.id,
      uploaderId: req.user.id,
      file: req.file,
      title: req.body.title,
      isConfidential: req.body.isConfidential === "true",
    });

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Delete a personal document controller
export const deletePersonalDocument = async (req, res, next) => {
  try {
    const result = await documentService.deletePersonalDocumentService({
      documentId: req.params.id,
    });

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Download a personal document controller
export const downloadPersonalDocument = async (req, res, next) => {
  try {
    await documentService.downloadPersonalDocumentService({
      documentId: req.params.id,
      res,
    });
  } catch (err) {
    if (!res.headersSent) next(err);
  }
};

// Consult a personal document controller
export const consultPersonalDocument = async (req, res, next) => {
  try {
    const result = await documentService.consultPersonalDocumentService({
      documentId: req.params.id,
    });

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get personal documents controller (With filters: By Confidentiality)
export const getPersonalDocuments = async (req, res, next) => {
  try {
    const result = await documentService.getPersonalDocumentsService({
      userId: req.params.id,
      queryParams: req.query,
      requester: req.user,
    });

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Toggle Document Confidentiality (True/False) (User himself or Admin)
export const toggleConfidentiality = async (req, res, next) => {
  try {
    const result = await documentService.toggleConfidentialityService({
      documentId: req.params.id,
    });

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------------------------------- //
// -------------------- ADMINISTRATIVE DOCUMENTS CONTROLLERS --------------------- //
// ------------------------------------------------------------------------------- //

// Get all administrative documents controller
export const getAllAdministrativeDocuments = async (req, res, next) => {
  try {
    const result = await documentService.getAdminDocumentsService({
      queryParams: req.query,
    });

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Upload an administrative document controller
export const uploadAdminDocument = async (req, res, next) => {
  try {
    const result = await documentService.uploadAdminDocumentService({
      file: req.file,
      title: req.body.title,
      documentTypeId: req.body.documentType_id,
      uploadedBy: req.user.id,
    });

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Download an administrative document controller
export const downloadAdminDocument = async (req, res, next) => {
  try {
    await documentService.downloadAdminDocumentService({
      documentId: req.params.id,
      res,
    });
  } catch (err) {
    if (!res.headersSent) next(err);
  }
};

// Consult an administrative document controller
export const consultAdminDocument = async (req, res, next) => {
  try {
    const result = await documentService.consultAdminDocumentService({
      documentId: req.params.id,
    });

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Delete an administrative document controller : STILL NOT TESTED
export const deleteAdminDocument = async (req, res, next) => {
  try {
    const result = await documentService.deleteAdminDocumentService({
      documentId: req.params.id,
    });

    res.status(result.code).json(result);
  }
  catch (err) {
    next(err);  
  }
};

// Generate an administratif document
export const generateDocument = async (req, res, next) => {
  try {
    const { templateName } = req.params;

    const result = await documentService.generateDocumentService({
      templateName,
      data: req.body,
      uploadedBy: req.user.id,
    });

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Send a generated document by email
export const sendGeneratedDocumentByEmail = async (req, res, next) => {
  try {
    const { documentId } = req.params;

    const result = await documentService.sendGeneratedDocumentByEmailService({
      documentId,
    });

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------------------------------- //
// ----------------------- DOCUMENT REQUEST CONTROLLERS -------------------------- //
// ------------------------------------------------------------------------------- //

export const fulfillDocumentRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file provided" });

    const result = await documentService.fulfillDocumentRequestService(id, file, req.user._id);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
