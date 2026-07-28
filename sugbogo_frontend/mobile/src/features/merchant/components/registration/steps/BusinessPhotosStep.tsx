import { Text, View } from "react-native";

/**
 * Placeholder for the business photos step.
 *
 * This step will handle storefront photos
 * and merchant verification images.
 */
export default function BusinessPhotosStep() {
  return (
    <View>
      <Text className="text-lg font-semibold text-text-primary">
        Business Photos
      </Text>

      <Text className="mt-2 text-text-secondary">
        Photo upload setup will be implemented here.
      </Text>
    </View>
  );
}
