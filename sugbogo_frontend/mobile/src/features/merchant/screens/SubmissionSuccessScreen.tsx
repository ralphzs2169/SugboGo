import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View, Text } from "react-native";

import Button from "@/shared/components/Button";
import { theme } from "@/constants/theme";

type SubmissionSuccessScreenProps = {
  /**
   * Called when the merchant finishes the success flow.
   *
   * Typically navigates back to the Merchant Portal.
   */
  onContinue: () => void;
};

/**
 * Displays a confirmation screen after a merchant application has been
 * successfully submitted.
 *
 * This screen serves as the final step of the registration flow,
 * informing merchants that their application is now under review
 * and providing a single action to return to the Merchant Portal.
 */
export default function SubmissionSuccessScreen({
  onContinue,
}: SubmissionSuccessScreenProps) {
  return (
    <View className="flex-1 justify-center bg-background px-8">
      <View className="items-center">
        <View className="mb-8 rounded-full bg-brand/10 p-6">
          <MaterialCommunityIcons
            name="check-decagram"
            size={72}
            color={theme.extends.colors.brand}
          />
        </View>

        <Text className="text-center text-3xl font-bold text-text-primary">
          Application Submitted
        </Text>

        <Text className="mt-4 text-center text-base leading-7 text-text-secondary">
          Your merchant application has been successfully submitted for review.
        </Text>

        <Text className="mt-2 text-center text-base leading-7 text-text-secondary">
          We'll notify you once our team has finished reviewing your
          application.
        </Text>
      </View>

      <View className="mt-12">
        <Button
          title="Go to Merchant Portal"
          className="w-full"
          fontClassName="font-bold"
          onPress={onContinue}
        />
      </View>
    </View>
  );
}
