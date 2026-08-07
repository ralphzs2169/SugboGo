import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";

type VerificationDocuments = MerchantRegistrationForm["verificationDocuments"];

type DocumentChanges = {
  hasChanges: boolean;
  deletedDocumentIds: number[];
};

/**
 * Returns true when no verification documents have been selected.
 *
 * This prevents a brand-new registration form from being
 * treated as having unsaved document changes before the
 * merchant uploads anything.
 */
function isDocumentsEmpty(documents: VerificationDocuments): boolean {
  return (
    documents.businessRegistration === null &&
    documents.authorizationDocument === null &&
    documents.additionalDocuments.length === 0
  );
}

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
 * Returns whether the previously saved business registration
 * has been removed.
 */
function hasDeletedBusinessRegistration(
  previous: VerificationDocuments,
  current: VerificationDocuments,
): boolean {
  return (
    previous.businessRegistration !== null &&
    current.businessRegistration === null
  );
}

/**
 * Returns whether the previously saved authorization document
 * has been removed.
 */
function hasDeletedAuthorizationDocument(
  previous: VerificationDocuments,
  current: VerificationDocuments,
): boolean {
  return (
    previous.authorizationDocument !== null &&
    current.authorizationDocument === null
  );
}

function findDeletedSingletonDocumentId(
  previous: { id?: number } | null,
  current: { id?: number } | null,
): number[] {
  if (!previous?.id || current?.id === previous.id) {
    return [];
  }

  return [previous.id];
}

/**
 * Detects additions, replacements and deletions since the last
 * successful document save.
 */
export function getDocumentChanges(
  previous: VerificationDocuments | null,
  current: VerificationDocuments,
): DocumentChanges {
  /**
   * During a brand-new application, nothing has been saved yet.
   * If no documents have been selected, there are no pending changes.
   */
  if (previous === null) {
    return {
      hasChanges: !isDocumentsEmpty(current),
      deletedDocumentIds: [],
    };
  }

  const deletedDocumentIds = [
    ...findDeletedSingletonDocumentId(
      previous.businessRegistration,
      current.businessRegistration,
    ),
    ...findDeletedSingletonDocumentId(
      previous.authorizationDocument,
      current.authorizationDocument,
    ),
    ...findDeletedAdditionalDocumentIds(
      previous.additionalDocuments,
      current.additionalDocuments,
    ),
  ];

  const hasChanges =
    hasNewBusinessRegistration(current) ||
    hasDeletedBusinessRegistration(previous, current) ||
    hasNewAuthorizationDocument(current) ||
    hasDeletedAuthorizationDocument(previous, current) ||
    hasNewAdditionalDocuments(current) ||
    deletedDocumentIds.length > 0;

  return {
    hasChanges,
    deletedDocumentIds,
  };
}
