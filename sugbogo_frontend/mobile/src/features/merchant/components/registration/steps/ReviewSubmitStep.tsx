import { View, Text } from "react-native";
import { useFormContext } from "react-hook-form";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";

export default function ReviewStep() {
  const { watch } = useFormContext<MerchantRegistrationForm>();

  const form = watch();

  return (
    <View className="bg-surface px-6 py-5">
      <View className="mb-5">
        <Text className="text-2xl font-bold text-text-primary">
          Review Application
        </Text>

        <Text className="mt-1 text-sm text-text-secondary">
          Review your information before submitting your merchant application.
        </Text>
      </View>

      <ReviewSection icon="store-outline" title="Business Identity">
        <ReviewRow label="Business Name" value={form.businessName} />

        <ReviewRow label="Category" value={form.businessCategory} />

        <ReviewRow label="Representative" value={form.representativeName} />

        <ReviewRow label="Role" value={form.representativeRole} />
      </ReviewSection>

      <ReviewSection icon="map-marker-outline" title="Business Location">
        <ReviewRow
          label="Address"
          value={`${form.streetAddress}, ${form.barangay}, ${form.city}`}
        />

        <ReviewRow label="Landmark" value={"None"} />
      </ReviewSection>

      <ReviewSection icon="clock-outline" title="Operating Hours">
        <Text className="text-sm text-text-secondary">
          Operating schedule will appear here.
        </Text>
      </ReviewSection>

      <ReviewSection icon="image-outline" title="Business Photos">
        <Text className="text-sm text-text-secondary">
          {form.businessPhotos?.additional?.length ?? 0} photos added
        </Text>
      </ReviewSection>

      <ReviewSection
        icon="file-document-outline"
        title="Verification Documents"
      >
        <Text className="text-sm text-text-secondary">
          Documents attached for review.
        </Text>
      </ReviewSection>
    </View>
  );
}

type ReviewSectionProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  children: React.ReactNode;
};

function ReviewSection({ icon, title, children }: ReviewSectionProps) {
  return (
    <View className="mb-4 rounded-xl border border-border-primary px-4 py-4">
      <View className="mb-3 flex-row items-center">
        <MaterialCommunityIcons name={icon} size={22} color="#F27F0D" />

        <Text className="ml-2 text-base font-semibold text-text-primary">
          {title}
        </Text>
      </View>

      <View>{children}</View>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <View className="mb-2">
      <Text className="text-xs font-medium text-text-secondary">{label}</Text>

      <Text className="mt-1 text-sm text-text-primary">
        {value || "Not provided"}
      </Text>
    </View>
  );
}
