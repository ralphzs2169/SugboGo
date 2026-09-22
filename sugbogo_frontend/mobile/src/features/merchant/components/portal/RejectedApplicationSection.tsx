import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import rejectedApplicationAnimation from "../../assets/animations/changes-required.json";
import type { ApplicationFeedbackResponse } from "../../types/registration/registrationApi.types";
import ResubmissionChecklist from "../registration/ResubmissionChecklist";

type RejectionApplicationSectionProps = {
  feedback: ApplicationFeedbackResponse[];
  reviewedAt: string;
};

/**
 * Displays the merchant application's rejected state.
 *
 * Uses the same status-first visual structure as the submitted application
 * state while focusing the merchant on required changes and review feedback.
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
          <AppText
            weight="bold"
            className="text-xs uppercase tracking-wide text-text-error"
          >
            Changes Required
          </AppText>
        </View>

        <AppText
          weight="bold"
          className="mt-3 text-center text-2xl text-text-primary"
        >
          Your application needs some changes
        </AppText>

        <AppText className="mt-2 max-w-sm text-center text-sm leading-6 text-text-secondary">
          Review the feedback, make the required changes, and resubmit.
        </AppText>
      </View>

      {/* Review information */}
      <View className="mt-4 flex-row items-center rounded-md border border-border-primary bg-surface px-4 py-4">
        <MaterialCommunityIcons
          name="calendar-check-outline"
          size={25}
          color={theme.extends.colors.text.secondary}
        />

        <View className="ml-3 flex-1">
          <AppText
            weight="semibold"
            className="text-xs uppercase tracking-wide text-text-secondary"
          >
            Reviewed
          </AppText>

          <AppText weight="bold" className="mt-0.5 text-base text-text-primary">
            {reviewedAt}
          </AppText>
        </View>
      </View>

      {/* Administrator feedback */}
      <View className="mt-4 rounded-md border border-border-primary bg-surface px-5 pt-5">
        <AppText weight="bold" className="mb-1 text-sm text-text-primary">
          Administrator Feedback
        </AppText>

        <ResubmissionChecklist feedback={feedback} isInMerchantPortal />
      </View>
    </View>
  );
}
