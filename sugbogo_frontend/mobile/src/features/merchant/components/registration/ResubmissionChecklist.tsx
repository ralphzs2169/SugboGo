import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import type { ApplicationFeedbackResponse } from "@/features/merchant/types/registration/registrationApi.types";
import AppText from "@/shared/components/AppText";
import RejectionCardIndicator from "./RejectionCardIndicator";

type ResubmissionChecklistProps = {
  feedback: ApplicationFeedbackResponse[];
  isInMerchantPortal?: boolean;
  embedded?: boolean;
  isReviewStep?: boolean;
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
  isInMerchantPortal = false,
  embedded = false,
  isReviewStep = false,
}: ResubmissionChecklistProps) {
  if (feedback.length === 0) {
    return null;
  }

  const allChangesMade = feedback.every((item) => item.is_changed);
  const standalone = !embedded && !isInMerchantPortal;

  return (
    <View
      className={
        isReviewStep
          ? "mb-4 w-full bg-surface p-4"
          : embedded
          ? "mt-4 border-t border-border-primary pt-4"
          : standalone
            ? "relative mb-4 rounded-card border border-border-primary bg-surface p-4"
            : "bg-surface py-4"
      }
    >
      {standalone && !isReviewStep && !allChangesMade && <RejectionCardIndicator />}
      <View>
        <View className="flex-row items-center justify-between gap-3">
          <AppText weight="bold" className="flex-1 text-xs text-text-secondary">
            {allChangesMade
              ? "SECTION CORRECTIONS COMPLETE"
              : "REQUIRED SECTION CORRECTIONS"}
          </AppText>
          {isReviewStep && !allChangesMade && (
            <MaterialCommunityIcons
              name="alert-circle"
              size={22}
              color={theme.extends.colors.error}
              accessible={false}
            />
          )}
        </View>

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
                  <AppText
                    weight="semibold"
                    className="text-sm  text-text-primary"
                  >
                    {SECTION_LABELS[item.section]}
                  </AppText>

                  {isInMerchantPortal && (
                    <AppText className="mt-1 text-sm leading-5 text-text-primary">
                      {item.message}
                    </AppText>
                  )}
                  <AppText className="mt-0.5 text-xs text-text-secondary">
                    {isChanged ? "Changes made" : "Changes still required"}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
