import { Text, View } from "react-native";

/**
 * Placeholder for the verification documents step.
 *
 * This step will handle business registration
 * documents and supporting requirements.
 */
export default function VerificationDocumentsStep() {
  return (
    <View>
      <Text className="text-lg font-semibold text-text-primary">
        Verification Documents
      </Text>

      <Text className="mt-2 text-text-secondary">
        Document verification setup will be implemented here.
      </Text>
    </View>
  );
}
