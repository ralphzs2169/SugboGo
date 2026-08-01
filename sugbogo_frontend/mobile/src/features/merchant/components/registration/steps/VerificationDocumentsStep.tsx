import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFormContext } from "react-hook-form";
import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";

export default function VerificationDocumentsStep() {
  const { watch } = useFormContext<MerchantRegistrationForm>();

  const documents = watch("verificationDocuments") ?? {
    businessRegistration: null,
    authorizationDocument: null,
    additionalDocuments: [],
  };

  return (
    <View className="bg-surface px-6 py-5">
      <View className="mb-5">
        <Text className="text-2xl font-bold text-text-primary">
          Verification Documents
        </Text>

        <Text className="mt-1 text-sm text-text-secondary">
          Upload documents that help us verify your business.
        </Text>
      </View>

      <DocumentUploadCard
        icon="file-document-outline"
        title="Business Registration Document"
        description="Upload your Mayor's Permit, DTI Registration, SEC Registration, or equivalent."
        required
        uploaded={!!documents.businessRegistration}
      />

      <DocumentUploadCard
        icon="account-check-outline"
        title="Authorization Document"
        description="Required if you are registering on behalf of the business owner."
        uploaded={!!documents.authorizationDocument}
      />

      <DocumentUploadCard
        icon="file-multiple-outline"
        title="Additional Documents"
        description="Upload supporting permits, certificates, or licenses."
        uploaded={documents.additionalDocuments.length > 0}
      />
    </View>
  );
}

type DocumentUploadCardProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description: string;
  required?: boolean;
  uploaded: boolean;
};

function DocumentUploadCard({
  icon,
  title,
  description,
  required,
  uploaded,
}: DocumentUploadCardProps) {
  return (
    <Pressable className="mb-4 rounded-xl border border-border-primary px-4 py-4">
      <View className="flex-row items-center">
        <MaterialCommunityIcons name={icon} size={24} color="#F27F0D" />

        <View className="ml-3 flex-1">
          <Text className="text-base font-semibold text-text-primary">
            {title}
            {required && <Text className="text-brand"> *</Text>}
          </Text>

          <Text className="mt-1 text-sm leading-5 text-text-secondary">
            {description}
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-center rounded-lg border border-dashed border-border-primary py-5">
        <MaterialCommunityIcons
          name={uploaded ? "check-circle-outline" : "cloud-upload-outline"}
          size={22}
          color={uploaded ? "#1B4D3E" : "#999999"}
        />

        <Text className="ml-2 text-sm font-medium text-text-secondary">
          {uploaded ? "Document Added" : "Upload Document"}
        </Text>
      </View>
    </Pressable>
  );
}
