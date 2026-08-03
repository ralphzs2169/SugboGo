import { useFormContext } from "react-hook-form";
import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import ReviewSection from "../ReviewSection";

type ReviewVerificationDocumentsProps = {
  onEdit?: () => void;
};
export default function ReviewVerificationDocuments({
  onEdit,
}: ReviewVerificationDocumentsProps) {
  const { watch } = useFormContext<MerchantRegistrationForm>();

  const documents = watch("verificationDocuments");

  return (
    <ReviewSection
      icon="file-document-outline"
      title="Verification Documents"
      onEdit={onEdit}
    >
      <DocumentGroup
        title="Business Registration"
        document={documents.businessRegistration}
        required
      />

      {documents.authorizationDocument && (
        <DocumentGroup
          title="Authorization Document"
          document={documents.authorizationDocument}
        />
      )}

      {documents.additionalDocuments.length > 0 && (
        <View>
          <Text className="mb-2 text-sm font-semibold text-text-primary">
            Additional Documents
          </Text>

          <View>
            {documents.additionalDocuments.map((document, index) => (
              <DocumentRow
                key={`${document.uri}-${index}`}
                document={document}
              />
            ))}
          </View>
        </View>
      )}
    </ReviewSection>
  );
}

type DocumentGroupProps = {
  title: string;
  document: MerchantRegistrationForm["verificationDocuments"]["businessRegistration"];
  required?: boolean;
};

function DocumentGroup({
  title,
  document,
  required = false,
}: DocumentGroupProps) {
  return (
    <View className="mb-4 last:mb-0">
      <View className="mb-2 flex-row items-center">
        <Text className="text-sm font-semibold text-text-primary">{title}</Text>

        {required && (
          <Text className="ml-1 text-sm font-semibold text-text-error">*</Text>
        )}
      </View>

      {document ? (
        <DocumentRow document={document} />
      ) : (
        <Text className="text-sm text-text-secondary">Not provided</Text>
      )}
    </View>
  );
}

type DocumentRowProps = {
  document: NonNullable<
    MerchantRegistrationForm["verificationDocuments"]["businessRegistration"]
  >;
};

function DocumentRow({ document }: DocumentRowProps) {
  return (
    <View className="flex-row items-center rounded-lg border border-border-primary px-3 py-3">
      <MaterialCommunityIcons
        name="file-document-outline"
        size={24}
        color="#F27F0D"
      />

      <View className="ml-3 flex-1">
        <Text
          className="text-sm font-medium text-text-primary"
          numberOfLines={1}
        >
          {document.fileName || "Document"}
        </Text>

        {document.mimeType && (
          <Text className="mt-0.5 text-xs text-text-secondary">
            {document.mimeType}
          </Text>
        )}
      </View>
    </View>
  );
}
