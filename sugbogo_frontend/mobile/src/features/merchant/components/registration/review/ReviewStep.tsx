import { View, Text } from "react-native";

import ReviewBusinessIdentity from "./sections/ReviewBusinessIdentity";
import ReviewBusinessLocation from "./sections/ReviewBusinessLocation";
import ReviewOperatingHours from "./sections/ReviewOperatingHours";
import ReviewBusinessPhotos from "./sections/ReviewBusinessPhotos";
import ReviewVerificationDocuments from "./sections/ReviewVerificationDocuments";

export default function ReviewStep() {
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

      <ReviewBusinessIdentity />

      <ReviewBusinessLocation />

      <ReviewOperatingHours />

      <ReviewBusinessPhotos />

      <ReviewVerificationDocuments />
    </View>
  );
}
