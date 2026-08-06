import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import type { ApplicationDocumentResponse } from "@/features/merchant/types/registration/registrationApi.types";
import { inferMimeType } from "@/shared/utils/inferMimeType.utils";

/**
 * Converts saved application document responses into the verification
 * document structure used by the merchant registration form.
 */
export function mapApplicationDocuments(
  documents: ApplicationDocumentResponse[],
): MerchantRegistrationForm["verificationDocuments"] {
  const businessRegistration = documents.find(
    (document) => document.document_type === "business_registration",
  );

  const authorizationDocument = documents.find(
    (document) => document.document_type === "authorization_document",
  );

  return {
    businessRegistration: businessRegistration
      ? {
          id: businessRegistration.id,
          uri: businessRegistration.document_url,
          fileName: businessRegistration.file_name,
          mimeType: inferMimeType(businessRegistration.file_name),
        }
      : null,

    authorizationDocument: authorizationDocument
      ? {
          id: authorizationDocument.id,
          uri: authorizationDocument.document_url,
          fileName: authorizationDocument.file_name,
          mimeType: inferMimeType(authorizationDocument.file_name),
        }
      : null,

    additionalDocuments: documents
      .filter((document) => document.document_type === "additional_documents")
      .map((document) => ({
        id: document.id,
        uri: document.document_url,
        fileName: document.file_name,
        mimeType: inferMimeType(document.file_name),
      })),
  };
}
