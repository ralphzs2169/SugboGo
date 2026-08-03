// ReviewVerificationDocuments.tsx
import { useFormContext } from "react-hook-form";
import DocumentGroup from "../DocumentGroup";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import ReviewSection from "../ReviewSection";

type ReviewVerificationDocumentsProps = {
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
  onEdit,
}: ReviewVerificationDocumentsProps) {
  const { watch } = useFormContext<MerchantRegistrationForm>();
  const documents = watch("verificationDocuments");

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
