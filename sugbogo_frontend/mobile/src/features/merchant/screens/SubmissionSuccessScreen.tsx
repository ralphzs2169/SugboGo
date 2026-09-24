import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import successAnimation from "@/shared/assets/animations/success-confetti.json";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

type SubmissionSuccessScreenProps = {
  reviewSlaMinBusinessDays: number;
  reviewSlaMaxBusinessDays: number;
  onContinue: () => void;
};

/**
 * Displays the success state after a merchant submits an application.
 *
 * Presents submission confirmation, the expected review window, and a primary
 * action for returning to the Merchant Portal.
 */
export default function SubmissionSuccessScreen({
  reviewSlaMinBusinessDays,
  reviewSlaMaxBusinessDays,
  onContinue,
}: SubmissionSuccessScreenProps) {
  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface">
      <View className="flex-1 justify-center px-8">
        {/* Success animation */}
        <View className="items-center justify-center">
          <LottieView
            source={successAnimation}
            autoPlay
            loop={false}
            style={{
              width: 250,
              height: 200,
            }}
          />
        </View>

        {/* Success message */}
        <View className="mb-7">
          <AppText
            weight="bold"
            className="text-center text-xl text-text-primary"
          >
            Application Submitted
          </AppText>

          <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
            Your application is now under review. We'll notify you once our team
            has finished reviewing it.
          </AppText>

          {/* Review estimate */}
          <View className="mt-4 flex-row items-center justify-center">
            <MaterialCommunityIcons
              name="clock-outline"
              size={16}
              color="#F27F0D"
            />

            <AppText
              weight="medium"
              className="ml-1.5 text-xs text-text-secondary"
            >
              Estimated review time: {reviewSlaMinBusinessDays}–
              {reviewSlaMaxBusinessDays} business days
            </AppText>
          </View>
        </View>

        {/* Primary follow-up action */}
        <Button
          title="Back to Merchant Portal"
          onPress={onContinue}
          icon={
            <MaterialCommunityIcons name="arrow-left" size={20} color="white" />
          }
          className="mt-2"
          textWeight="bold"
          rounded="full"
        />
      </View>
    </SafeAreaView>
  );
}
