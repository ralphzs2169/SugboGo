import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { ApplicationFeedbackResponse } from "../../types/registration/registrationApi.types";
import ResubmissionChecklist from "../registration/ResubmissionChecklist";
import rejectedApplicationAnimation from "../../assets/animations/changes-required.json";
import LottieView from "lottie-react-native";

type RejectionApplicationSectionProps = {
  feedback: ApplicationFeedbackResponse[];
  reviewedAt: string;
};

/**
 * Displays the merchant application's rejected state.
 *
 * Uses the same status-first visual structure as the submitted application
 * state while focusing the merchant on the required changes and review
 * feedback needed for resubmission.
 */
export default function RejectionApplicationSection({
  feedback,
  reviewedAt,
}: RejectionApplicationSectionProps) {
  return (
    <View className="bg-surface px-6 pb-6">
      {/* Status hero */}
      <View className="items-center rounded-3xl bg-surface px-6 py-7">
        <LottieView
          source={rejectedApplicationAnimation}
          autoPlay
          loop={false}
          style={{ width: 80, height: 80 }}
        />

        <View className="mt-4 rounded-full bg-text-error/10 px-3.5 py-1.5">
          <Text className="text-xs font-bold uppercase tracking-wide text-text-error">
            Changes Required
          </Text>
        </View>

        <Text className="mt-3 text-center text-2xl font-bold text-text-primary">
          Your application needs some changes
        </Text>

        <Text className="mt-2 max-w-sm text-center text-sm leading-6 text-text-secondary">
          Review the feedback, make the required changes, and resubmit.
        </Text>
      </View>

      {/* Review information */}
      <View className="mt-4 flex-row items-center rounded-2xl border border-border-primary bg-surface px-4 py-4">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-text-error/90">
          <MaterialCommunityIcons
            name="calendar-check-outline"
            size={21}
            color="white"
          />
        </View>

        <View className="ml-3 flex-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Reviewed
          </Text>

          <Text className="mt-0.5 text-base font-bold text-text-primary">
            {reviewedAt}
          </Text>
        </View>
      </View>

      {/* Administrator feedback */}
      <View className="mt-4 rounded-2xl border border-border-primary bg-surface px-5 pt-5">
        <Text className="mb-1 text-sm font-bold text-text-primary">
          Administrator Feedback
        </Text>

        <ResubmissionChecklist feedback={feedback} isInMerchantPortal={true} />
      </View>
    </View>
  );
}
