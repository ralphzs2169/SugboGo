import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";

type VerificationDocuments = MerchantRegistrationForm["verificationDocuments"];

type DetectDocumentChangesResult = {
  hasChanges: boolean;
  deletedDocumentIds: number[];
};

/**
 * Finds the IDs of additional documents that existed previously but
 * have since been removed.
 */
function findDeletedAdditionalDocumentIds(
  previous: { id?: number }[],
  current: { id?: number }[],
): number[] {
  return previous
    .filter(
      (document) =>
        document.id !== undefined &&
        !current.some((currentDocument) => currentDocument.id === document.id),
    )
    .map((document) => document.id as number);
}

/**
 * Returns whether a replacement business registration has been selected.
 */
function hasNewBusinessRegistration(documents: VerificationDocuments): boolean {
  return (
    documents.businessRegistration !== null &&
    documents.businessRegistration.id === undefined
  );
}

/**
 * Returns whether a replacement authorization document has been selected.
 */
function hasNewAuthorizationDocument(
  documents: VerificationDocuments,
): boolean {
  return (
    documents.authorizationDocument !== null &&
    documents.authorizationDocument.id === undefined
  );
}

/**
 * Returns whether any new additional documents have been selected.
 */
function hasNewAdditionalDocuments(documents: VerificationDocuments): boolean {
  return documents.additionalDocuments.some(
    (document) => document.id === undefined,
  );
}

/**
 * Detects additions, replacements and deletions since the last
 * successful document save.
 */
export function detectDocumentChanges(
  previous: VerificationDocuments | null,
  current: VerificationDocuments,
): DetectDocumentChangesResult {
  // Nothing has ever been saved.
  if (previous === null) {
    return {
      hasChanges: true,
      deletedDocumentIds: [],
    };
  }

  const deletedDocumentIds = findDeletedAdditionalDocumentIds(
    previous.additionalDocuments,
    current.additionalDocuments,
  );

  const hasChanges =
    hasNewBusinessRegistration(current) ||
    hasNewAuthorizationDocument(current) ||
    hasNewAdditionalDocuments(current) ||
    deletedDocumentIds.length > 0;

  return {
    hasChanges,
    deletedDocumentIds,
  };
}
