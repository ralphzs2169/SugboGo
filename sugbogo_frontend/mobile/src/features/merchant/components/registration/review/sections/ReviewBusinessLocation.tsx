import { useFormContext } from "react-hook-form";
import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import ReviewSection from "../ReviewSection";
import ReviewRow from "../ReviewRow";
import LocationPickerMap from "../../location/LocationPickerMap";
import { theme } from "@/constants/theme";

type ReviewBusinessLocationProps = {
  onEdit?: () => void;
};

export default function ReviewBusinessLocation({
  onEdit,
}: ReviewBusinessLocationProps) {
  const { watch } = useFormContext<MerchantRegistrationForm>();

  const form = watch();

  const address = [form.streetAddress, form.barangay, form.city, form.province]
    .filter(Boolean)
    .join(", ");

  const handleViewLandmarks = () => {
    console.log("Navigating to review landmarks page");
    router.push("/(explorer)/merchant-registration/review-landmarks");
  };

  return (
    <ReviewSection
      icon="map-marker-outline"
      title="Business Location"
      onEdit={onEdit}
    >
      <LocationPickerMap
        latitude={form.latitude}
        longitude={form.longitude}
        interactionEnabled={false}
        showLocationPreviewOverlay={false}
      />

      <View className="mt-4 flex-row flex-wrap">
        {/* Address */}
        <View className="w-full">
          <ReviewRow label="Address" value={address} />
        </View>

        {/* Unit / Building */}
        <View className="w-full">
          <ReviewRow label="Unit / Building" value={form.unit} />
        </View>
        <View className="w-full">
          <Text className="mb-2 text-xs font-medium text-text-secondary">
            Landmarks
          </Text>

          {form.landmarks.length > 0 ? (
            <Pressable onPress={handleViewLandmarks}>
              {({ pressed }) => (
                <View
                  className={`flex-row items-center justify-between rounded-lg border border-border-primary px-3 py-3 ${
                    pressed ? "bg-background" : "bg-surface"
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-text-primary">
                      View landmarks
                    </Text>

                    <Text className="mt-0.5 text-xs text-text-secondary">
                      {form.landmarks.length} landmark
                      {form.landmarks.length !== 1 ? "s" : ""} selected
                    </Text>
                  </View>

                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={theme.extends.colors.text.secondary}
                  />
                </View>
              )}
            </Pressable>
          ) : (
            <Text className="text-sm text-text-primary">Not provided</Text>
          )}
        </View>
      </View>
    </ReviewSection>
  );
}
