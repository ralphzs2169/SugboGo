import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";
import ContinueRegitstrationIllustration from "../../assets/illustrations/application-resume-progress.svg";

type ResumeApplicationSectionProps = {
  currentStep: number;
  totalSteps: number;
  lastUpdated: string;
};

/**
 * Displays the user's current merchant registration progress.
 *
 * Shows a continuation state while registration is in progress and
 * switches to a final-review state when the user reaches the last step.
 */
export default function ResumeApplicationSection({
  currentStep,
  totalSteps,
  lastUpdated,
}: ResumeApplicationSectionProps) {
  const isFinalStep = currentStep === totalSteps;
  const progress = (currentStep / totalSteps) * 100;

  const title = isFinalStep
    ? "Your registration is almost complete"
    : "Continue your registration";

  const description = isFinalStep
    ? "You've completed all required sections. Review your application before submitting."
    : "Your progress has been saved. Continue where you left off.";

  const progressDescription = isFinalStep
    ? "Ready for final review"
    : "Continue completing your merchant application.";

  return (
    <View className="bg-surface px-6 pt-6 pb-8">
      {/* Registration illustration */}
      <ContinueRegitstrationIllustration width="100%" height={180} />

      {/* Registration status heading */}
      <Text className="mb-2 mt-4 text-center text-xl font-bold text-text-primary">
        {title}
      </Text>

      <Text className="mb-6 text-center text-base text-text-secondary">
        {description}
      </Text>

      {/* Progress card */}
      <View className="rounded-2xl border border-border-primary bg-background px-5 py-5">
        {/* Step + Progress */}
        <View className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-brand/10">
            <MaterialCommunityIcons
              name={isFinalStep ? "check-circle-outline" : "progress-pencil"}
              size={18}
              color={theme.extends.colors.brand}
            />
          </View>

          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary">
              Step {currentStep} of {totalSteps}
            </Text>

            <Text className="mt-0.5 text-sm text-text-secondary">
              {progressDescription}
            </Text>
          </View>

          <Text className="text-sm font-semibold text-brand">
            {Math.round(progress)}%
          </Text>
        </View>

        {/* Progress bar */}
        <View className="mt-4 h-2 overflow-hidden rounded-full bg-border">
          <View
            className="h-full rounded-full bg-brand"
            style={{ width: `${progress}%` }}
          />
        </View>

        {/* Last Updated */}
        <View className="mt-4 flex-row items-center gap-2 border-t border-border-primary/60 pt-4">
          <MaterialCommunityIcons
            name="history"
            size={16}
            color={theme.extends.colors.text.secondary ?? "#9CA3AF"}
          />

          <Text className="text-sm text-text-secondary">
            Last updated {lastUpdated}
          </Text>
        </View>
      </View>
    </View>
  );
}
