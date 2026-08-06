import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";

type VerificationDocuments = MerchantRegistrationForm["verificationDocuments"];

/**
 * Builds the multipart payload required for uploading
 * merchant verification documents.
 *
 * Only newly selected files are included in the upload.
 * Existing documents are represented by their IDs and are
 * therefore skipped. IDs of removed additional documents
 * are included so the backend can delete them.
 */
export function buildDocumentUploadFormData(
  documents: VerificationDocuments,
  deletedDocumentIds: number[],
) {
  const formData = new FormData();

  const businessRegistration = documents.businessRegistration;

  // Upload a replacement business registration document, if one
  // has been selected since the last successful save.
  if (businessRegistration && businessRegistration.id === undefined) {
    formData.append("business_registration", {
      uri: businessRegistration.uri,
      name: businessRegistration.fileName ?? "business-registration",
      type: businessRegistration.mimeType ?? "application/pdf",
    } as any);
  }

  const authorizationDocument = documents.authorizationDocument;

  // Upload a replacement authorization document, if one
  // has been selected since the last successful save.
  if (authorizationDocument && authorizationDocument.id === undefined) {
    formData.append("authorization_document", {
      uri: authorizationDocument.uri,
      name: authorizationDocument.fileName ?? "authorization-document",
      type: authorizationDocument.mimeType ?? "application/pdf",
    } as any);
  }

  // Upload any newly added supporting documents.
  documents.additionalDocuments
    .filter((document) => document.id === undefined)
    .forEach((document) => {
      formData.append("additional_documents", {
        uri: document.uri,
        name: document.fileName ?? "additional-document",
        type: document.mimeType ?? "application/pdf",
      } as any);
    });

  // Inform the backend which previously uploaded additional
  // documents should be removed.
  deletedDocumentIds.forEach((id) => {
    formData.append("deleted_document_ids", String(id));
  });

  return formData;
}
