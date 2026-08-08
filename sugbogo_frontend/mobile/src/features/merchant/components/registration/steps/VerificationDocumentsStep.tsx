import { Text, View } from "react-native";
import { useFormContext } from "react-hook-form";

import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";
import DocumentUploadCard from "../verification-documents/DocumentUploadCard";
import RegistrationSection from "../RegistrationSection";
import useRegistrationErrorScroll from "@/features/merchant/hooks/registration/useRegistrationErrorScroll";

type OperatingHoursStepProps = {
  registerErrorScrollTarget: ReturnType<
    typeof useRegistrationErrorScroll
  >["registerErrorScrollTarget"];
};

export default function VerificationDocumentsStep({
  registerErrorScrollTarget,
}: OperatingHoursStepProps) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<MerchantRegistrationForm>();

  const documents = watch("verificationDocuments");

  const businessRegistrationError =
    errors.verificationDocuments?.businessRegistration?.message;

  return (
    <View className="bg-background">
      <RegistrationSection
        icon="file-document-outline"
        title="Business Registration"
        description="Upload proof of business registration, such as a DTI Certificate, SEC Certificate, or Mayor’s Permit."
        showBorder={false}
      >
        <View
          {...registerErrorScrollTarget(
            "verificationDocuments.businessRegistration",
          )}
        >
          <DocumentUploadCard
            document={documents.businessRegistration}
            maxDocuments={1}
            required
            error={businessRegistrationError}
            onDocumentChange={(value) =>
              setValue("verificationDocuments.businessRegistration", value, {
                shouldDirty: true,
                shouldValidate:
                  !!errors.verificationDocuments?.businessRegistration,
              })
            }
          />
        </View>
      </RegistrationSection>

      <RegistrationSection
        icon="account-check-outline"
        title="Authorization Document"
        description="If registering for the owner, provide an authorization letter or signed authorization form."
        showBorder={false}
      >
        <DocumentUploadCard
          document={documents.authorizationDocument}
          maxDocuments={1}
          onDocumentChange={(value) =>
            setValue("verificationDocuments.authorizationDocument", value, {
              shouldDirty: true,
            })
          }
        />
      </RegistrationSection>

      <RegistrationSection
        icon="file-multiple-outline"
        title="Additional Documents"
        description="Add any other permits, certificates, or licenses that support your application."
        showBorder={false}
      >
        <DocumentUploadCard
          documents={documents.additionalDocuments}
          multiple
          maxDocuments={5}
          onDocumentsChange={(value) =>
            setValue("verificationDocuments.additionalDocuments", value, {
              shouldDirty: true,
            })
          }
        />
      </RegistrationSection>
    </View>
  );
}
