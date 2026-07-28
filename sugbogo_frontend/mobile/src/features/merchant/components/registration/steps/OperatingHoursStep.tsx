import { Text, View } from "react-native";

/**
 * Placeholder for the operating hours step.
 *
 * This step will collect the merchant's weekly schedule.
 */
export default function OperatingHoursStep() {
  return (
    <View>
      <Text className="text-lg font-semibold text-text-primary">
        Operating Hours
      </Text>

      <Text className="mt-2 text-text-secondary">
        Operating hours setup will be implemented here.
      </Text>
    </View>
  );
}
