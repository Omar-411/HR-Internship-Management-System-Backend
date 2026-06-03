import Document from "../../models/Document.js";
import DocumentType from "../../models/DocumentType.js";
import { getPersonalType, findType } from "../../utils/documentHelper.js";

// Get administrative documents KPIs
export const getAdminDocumentsKPIsService = async () => {
  // Get the "Personal" document type so we can exclude personal documents
  const personalType = await getPersonalType();

  // Get all administrative document types
  const adminDocumentTypes = await DocumentType.find({
    _id: { $ne: personalType._id },
  });

  // Find the required document types
  const certificateType = findType(adminDocumentTypes, "Certificate");
  const reportType = findType(adminDocumentTypes, "Report");
  const contractType = findType(adminDocumentTypes, "Contract");

  // Count documents for each type
  const [
    totalCertificates,
    totalReports,
    totalContracts,
    totalAdministrativeDocuments,
  ] = await Promise.all([
    certificateType
      ? Document.countDocuments({
          documentType_id: certificateType._id,
          projectId: null,
        })
      : 0,

    reportType
      ? Document.countDocuments({
          documentType_id: reportType._id,
          projectId: null,
        })
      : 0,

    contractType
      ? Document.countDocuments({
          documentType_id: contractType._id,
          projectId: null,
        })
      : 0,

    // Count all administrative documents
    Document.countDocuments({
      documentType_id: { $ne: personalType._id },
      projectId: null,
    }),
  ]);

  return {
    status: "Success",
    code: 200,
    message: "Administrative documents KPIs retrieved successfully!",
    data: {
      totalCertificates,
      totalReports,
      totalContracts,
      totalAdministrativeDocuments,
    },
  };
};
