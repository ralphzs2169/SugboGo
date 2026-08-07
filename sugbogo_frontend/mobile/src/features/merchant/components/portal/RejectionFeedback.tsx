import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";
import ReviewChangesIllustration from "../../assets/illustrations/review-changes.svg";
import { ApplicationFeedbackResponse } from "../../types/registration/registrationApi.types";
import AdministratorFeedback from "../registration/AdministratorFeedback";

type RejectionFeedbackCardProps = {
  feedback: ApplicationFeedbackResponse[];
  reviewedAt: string;
};

/**
 * Displays the rejection summary for a merchant application.
 *
 * This card introduces the resubmission process, shows when the
 * application was reviewed, and surfaces the administrator's
 * section-specific feedback.
 */
export default function RejectionFeedbackCard({
  feedback,
  reviewedAt,
}: RejectionFeedbackCardProps) {
  return (
    <View className="bg-surface px-6 py-6">
      <Text className="mb-2 text-3xl font-bold text-text-primary">
        Application Feedback
      </Text>

      <Text className="mb-6 text-base text-text-secondary">
        Your application requires a few revisions before it can be approved.
      </Text>

      {/* Hero */}
      <View className="items-center border-b border-border-primary/60 pb-6">
        <ReviewChangesIllustration width={180} height={180} />

        <View className="mt-2 flex-row items-center rounded-full bg-error/10 px-4 py-2">
          <View className="mt-4 rounded-full bg-border-error px-4 py-2">
            <Text className=" text-white">Changes Required</Text>
          </View>
        </View>
      </View>

      {/* Review date */}
      <View className="flex-row items-center border-b border-border-primary/60 py-5">
        <MaterialCommunityIcons
          name="calendar-check-outline"
          size={20}
          color={theme.extends.colors.brand}
        />

        <View className="ml-3">
          <Text className="text-xs uppercase tracking-wide text-text-tertiary">
            Reviewed
          </Text>

          <Text className="mt-1 text-sm font-semibold text-text-primary">
            {reviewedAt}
          </Text>
        </View>
      </View>

      {/* Administrator feedback */}
      <View className="mt-6">
        <Text className="mb-4 text-lg font-bold text-text-primary">
          Administrator Feedback
        </Text>

        <AdministratorFeedback feedback={feedback} />
      </View>
    </View>
  );
}
