// ReviewVerificationDocuments.tsx
import type { z } from "zod";

import { merchantRegistrationSchema } from "@/features/merchant/validation/merchantRegistration.schema";
import DocumentGroup from "../DocumentGroup";
import ReviewSection from "../ReviewSection";

type ReviewForm = z.input<typeof merchantRegistrationSchema>;
type ReviewVerificationDocumentsProps = {
  form: ReviewForm;
  onEdit?: () => void;
};

/**
 * Displays the verification documents included in the merchant application.
 *
 * Documents are grouped into:
 * - Business Registration: required document.
 * - Authorization Document: optional document.
 * - Additional Documents: optional list of supporting documents.
 */
export default function ReviewVerificationDocuments({
  form,
  onEdit,
}: ReviewVerificationDocumentsProps) {
  const documents = form.verificationDocuments;

  const groups = [
    {
      title: "Business Registration",
      document: documents.businessRegistration,
      required: true,
    },
    {
      title: "Authorization Documents",
      document: documents.authorizationDocument,
    },
    {
      title: "Additional Documents",
      documents: documents.additionalDocuments,
    },
  ].filter(
    (group) =>
      group.required || group.document || (group.documents?.length ?? 0) > 0,
  );

  return (
    <ReviewSection
      icon="file-document-outline"
      title="Verification Documents"
      onEdit={onEdit}
    >
      {groups.map((group) => (
        <DocumentGroup
          key={group.title}
          title={group.title}
          document={group.document}
          documents={group.documents}
        />
      ))}
    </ReviewSection>
  );
}
