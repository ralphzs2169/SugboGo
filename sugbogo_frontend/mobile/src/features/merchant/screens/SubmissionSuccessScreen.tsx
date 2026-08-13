import LottieView from "lottie-react-native";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import successAnimation from "@/shared/assets/animations/success-confetti.json";
import Button from "@/shared/components/Button";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type SubmissionSuccessScreenProps = {
  /**
   * Displays the configured estimated review window and
   * provides the action for leaving the success flow.
   */
  reviewSlaMinBusinessDays: number;
  reviewSlaMaxBusinessDays: number;
  onContinue: () => void;
};

export default function SubmissionSuccessScreen({
  reviewSlaMinBusinessDays,
  reviewSlaMaxBusinessDays,
  onContinue,
}: SubmissionSuccessScreenProps) {
  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface">
      <View className="flex-1 justify-center px-8">
        {/* Success message */}
        <View className="items-center">
          <LottieView
            source={successAnimation}
            autoPlay
            loop={false}
            style={{ width: 260, height: 260 }}
          />

          <Text className="mt-2 text-center text-3xl font-bold text-text-primary">
            Application Submitted
          </Text>

          <Text className="mt-3 text-center text-base leading-7 text-text-secondary">
            Your application is now under review. We'll notify you as soon as
            our team has finished taking a look.
          </Text>

          <View className="mt-6 flex-row items-center rounded-2xl bg-background px-4 py-3">
            <View className="h-2 w-2 rounded-full bg-brand" />

            <Text className="ml-2 text-sm font-medium text-text-secondary">
              Estimated review time: {reviewSlaMinBusinessDays}–
              {reviewSlaMaxBusinessDays} business days
            </Text>
          </View>
        </View>

        {/* Continue action */}
        <View className="mt-12">
          <Button
            title="Back to Merchant Portal"
            icon={
              <MaterialCommunityIcons
                name="arrow-left"
                size={20}
                color="white"
              />
            }
            className="w-full"
            fontClassName="font-bold"
            onPress={onContinue}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
