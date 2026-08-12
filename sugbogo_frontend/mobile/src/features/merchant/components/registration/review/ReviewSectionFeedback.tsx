import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";
import type { ApplicationFeedbackResponse } from "@/features/merchant/types/registration/registrationApi.types";

type ReviewSectionFeedbackProps = {
  feedback?: ApplicationFeedbackResponse;
};

/**
 * Displays section-specific administrator feedback and indicates
 * whether the merchant has successfully changed the flagged section.
 */
export default function ReviewSectionFeedback({
  feedback,
}: ReviewSectionFeedbackProps) {
  if (!feedback) {
    return null;
  }

  const isChanged = feedback.is_changed;

  return (
    <View className="relative mb-5">
      {/* Feedback container */}
      <View
        className={`rounded-md border p-4 pr-10 ${
          isChanged
            ? "border-border-success bg-green-50"
            : "border-border-error bg-red-50"
        }`}
      >
        {/* Status indicator */}
        <MaterialCommunityIcons
          name={isChanged ? "check" : "alert"}
          size={22}
          color={
            isChanged
              ? theme.extends.colors.success
              : theme.extends.colors.error
          }
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
          }}
        />

        {/* Feedback content */}
        <Text className="text-xs font-bold text-text-secondary">
          {isChanged ? "CHANGES MADE" : "CHANGES REQUESTED"}
        </Text>

        <Text className="mt-1 text-sm leading-6 text-text-primary">
          {feedback.message}
        </Text>
      </View>
    </View>
  );
}
