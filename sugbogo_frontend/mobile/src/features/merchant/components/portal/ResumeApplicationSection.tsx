import LottieView from "lottie-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";
import resumeAnimation from "../../assets/animations/FbpImPYySG.json";

type ResumeApplicationSectionProps = {
  currentStep: number;
  totalSteps: number;
  lastUpdated: string;
};

/**
 * Displays the merchant application's current draft progress.
 *
 * Highlights the saved progress, shows the current completion percentage,
 * and guides the merchant toward continuing or completing the final review.
 */
export default function ResumeApplicationSection({
  currentStep,
  totalSteps,
  lastUpdated,
}: ResumeApplicationSectionProps) {
  const isFinalStep = currentStep === totalSteps;
  const progress = Math.min((currentStep / totalSteps) * 100, 100);

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
    <View className="bg-surface px-6 pb-6">
      {/* Draft status hero */}
      <View className="items-center rounded-3xl bg-surface px-6 py-7">
        <View className="h-20 w-20 items-center justify-center">
          <LottieView
            source={resumeAnimation}
            autoPlay
            loop
            style={{ width: 60, height: 60, padding: 10 }}
          />
        </View>

        <View className="mt-3 rounded-full bg-brand/10 px-3.5 py-1.5">
          <Text className="text-xs font-bold uppercase tracking-wide text-brand">
            {isFinalStep ? "Ready for Review" : "In Progress"}
          </Text>
        </View>

        <Text className="mt-3 text-center text-2xl font-bold text-text-primary">
          {title}
        </Text>

        <Text className="mt-2 max-w-sm text-center text-sm leading-6 text-text-secondary">
          {description}
        </Text>
      </View>

      {/* Registration progress */}
      <View className="mt-4 rounded-2xl border border-border-primary bg-surface px-5 py-5">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand/90">
            <MaterialCommunityIcons
              name={isFinalStep ? "check-circle-outline" : "progress-pencil"}
              size={21}
              color="white"
            />
          </View>

          <View className="flex-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Registration Progress
            </Text>

            <Text className="mt-0.5 text-base font-bold text-text-primary">
              Step {currentStep} of {totalSteps}
            </Text>
          </View>

          <Text className="text-base font-bold text-brand">
            {Math.round(progress)}%
          </Text>
        </View>

        {/* Progress bar */}
        <View className="mt-5 h-2 overflow-hidden rounded-full bg-border">
          <View
            className="h-full rounded-full bg-brand"
            style={{ width: `${progress}%` }}
          />
        </View>

        <Text className="mt-2 text-xs text-text-secondary">
          {progressDescription}
        </Text>
      </View>

      {/* Last updated */}
      <View className="mt-4 flex-row items-center rounded-2xl border border-border-primary bg-surface px-4 py-4">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-background">
          <MaterialCommunityIcons
            name="history"
            size={21}
            color={theme.extends.colors.text.secondary ?? "#9CA3AF"}
          />
        </View>

        <View className="ml-3 flex-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Last Updated
          </Text>

          <Text className="mt-0.5 text-base font-bold text-text-primary">
            {lastUpdated}
          </Text>
        </View>
      </View>
    </View>
  );
}
