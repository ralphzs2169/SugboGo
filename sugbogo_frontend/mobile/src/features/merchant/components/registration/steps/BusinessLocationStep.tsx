import { Text, View } from "react-native";

/**
 * Placeholder for the business location step.
 *
 * This step will handle map pinning,
 * address selection, and location verification.
 */
export default function BusinessLocationStep() {
  return (
    <View>
      <Text className="text-lg font-semibold text-text-primary">
        Business Location
      </Text>

      <Text className="mt-2 text-text-secondary">
        Location setup will be implemented here.
      </Text>
    </View>
  );
}
