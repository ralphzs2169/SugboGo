import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";
import type { ApplicationFeedbackResponse } from "@/features/merchant/types/registration/registrationApi.types";

type ResubmissionChecklistProps = {
  feedback: ApplicationFeedbackResponse[];
  padding?: boolean;
};

const SECTION_LABELS: Record<ApplicationFeedbackResponse["section"], string> = {
  identity: "Business Identity",
  location: "Business Location",
  operating_hours: "Operating Hours",
  photos: "Business Photos",
  documents: "Verification Documents",
};

/**
 * Displays the resubmission progress for sections that were flagged
 * during the administrator's previous review.
 *
 * A section is marked as completed when its persisted feedback status
 * indicates that the merchant has changed that section.
 */
export default function ResubmissionChecklist({
  feedback,
  padding = false,
}: ResubmissionChecklistProps) {
  if (feedback.length === 0) {
    return null;
  }

  const allChangesMade = feedback.every((item) => item.is_changed);

  return (
    <View
      className={`relative mb-4 border-b border-border-primary bg-surface ${
        padding ? "px-6 py-6" : "py-6"
      }`}
    >
      {/* Checklist status icon */}
      <MaterialCommunityIcons
        name={allChangesMade ? "check-circle" : "alert-circle"}
        size={22}
        color={
          allChangesMade
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

      {/* Resubmission checklist */}
      <View
        className={`rounded-md p-4 ${
          allChangesMade
            ? "border border-border-success bg-green-50"
            : "border border-border-error bg-red-50"
        }`}
      >
        <Text className="text-xs font-bold text-text-secondary">
          {allChangesMade ? "READY TO RESUBMIT" : "CHANGES REQUIRED"}
        </Text>

        <Text className="mt-1 text-sm leading-6 text-text-primary">
          {allChangesMade
            ? "All requested sections have been updated."
            : "Update the sections requested by the administrator before resubmitting."}
        </Text>

        {/* Section checklist */}
        <View className="mt-4 gap-3">
          {feedback.map((item) => {
            const isChanged = item.is_changed;

            return (
              <View key={item.section} className="flex-row items-center gap-3">
                <MaterialCommunityIcons
                  name={isChanged ? "check" : "circle-outline"}
                  size={isChanged ? 20 : 15}
                  color={
                    isChanged
                      ? theme.extends.colors.success
                      : theme.extends.colors.error
                  }
                />

                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text-primary">
                    {SECTION_LABELS[item.section]}
                  </Text>

                  <Text className="mt-0.5 text-xs text-text-secondary">
                    {isChanged ? "Changes made" : "Changes still required"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
