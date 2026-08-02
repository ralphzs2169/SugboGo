import { useFormContext } from "react-hook-form";
import { View, Text } from "react-native";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import ReviewSection from "../ReviewSection";
import ReviewRow from "../ReviewRow";
import LocationPickerMap from "../../location/LocationPickerMap";

export default function ReviewBusinessLocation() {
  const { watch } = useFormContext<MerchantRegistrationForm>();

  const form = watch();

  const address = [form.streetAddress, form.barangay, form.city, form.province]
    .filter(Boolean)
    .join(", ");

  const landmarkNames = form.landmarks
    .map((landmark) => landmark.name)
    .join(", ");

  return (
    <ReviewSection icon="map-marker-outline" title="Business Location">
      <LocationPickerMap
        latitude={form.latitude}
        longitude={form.longitude}
        interactionEnabled={false}
        showLocationPreviewOverlay={false}
      />

      <View className="mt-4 flex-row flex-wrap">
        <View className="w-full">
          <ReviewRow label="Address" value={address} />
        </View>

        <View className="w-1/2 pr-2">
          <ReviewRow label="Unit / Building" value={form.unit} />
        </View>

        <View className="w-full">
          <Text className="mb-2 text-xs font-medium text-text-secondary">
            Landmarks
          </Text>

          {form.landmarks.length > 0 ? (
            form.landmarks.map((landmark) => (
              <ReviewRow
                key={landmark.id}
                label={landmark.name}
                value={landmark.address}
              />
            ))
          ) : (
            <ReviewRow label="Landmarks" value="None" />
          )}
        </View>
      </View>
    </ReviewSection>
  );
}
