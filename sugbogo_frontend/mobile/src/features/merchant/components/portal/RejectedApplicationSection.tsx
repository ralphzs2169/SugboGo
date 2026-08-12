import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";
import RejectedStatusIllustartion from "../../assets/illustrations/application-rejected.svg";
import { ApplicationFeedbackResponse } from "../../types/registration/registrationApi.types";
import ResubmissionChecklist from "../registration/ResubmissionChecklist";

type RejectionApplicationSectionProps = {
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
export default function RejectionApplicationSection({
  feedback,
  reviewedAt,
}: RejectionApplicationSectionProps) {
  return (
    <View className="bg-surface px-6 pb-6">
      {/* Hero */}
      <View className="items-center border-b border-border-primary/60 pb-6">
        <RejectedStatusIllustartion width="100%" height={180} />

        <View className=" flex-row items-center rounded-full bg-error/10 px-4 pb-2">
          <View className="mt-4 rounded-full bg-red-500 px-4 py-2">
            <Text className=" text-white">Changes Required</Text>
          </View>
        </View>

        <Text className="mt-4 text-center text-xl font-bold text-text-primary">
          Your application needs some changes
        </Text>

        <Text className="mt-2 text-center text-base leading-6 text-text-secondary">
          Review the feedback, make the required changes, and resubmit.
        </Text>
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
        <Text className="mb-2 text-md font-bold text-text-primary">
          Administrator Feedback
        </Text>

        <ResubmissionChecklist feedback={feedback} />
      </View>
    </View>
  );
}
