import { Text, View } from "react-native";

/**
 * Final review step before submitting
 * merchant registration.
 */
export default function ReviewSubmitStep() {
  return (
    <View>
      <Text className="text-lg font-semibold text-text-primary">
        Review & Submit
      </Text>

      <Text className="mt-2 text-text-secondary">
        Review summary will be implemented here.
      </Text>
    </View>
  );
}
