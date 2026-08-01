import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { theme } from "@/constants/theme";

type RegistrationProgressCardProps = {
  currentStep: number;
  totalSteps: number;
  lastUpdated: string;
};

/**
 * Displays the user's current merchant registration progress.
 *
 * Shown when the user's merchant application is still in
 * the draft state and can be continued later.
 */
export default function RegistrationProgressCard({
  currentStep,
  totalSteps,
  lastUpdated,
}: RegistrationProgressCardProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <View className="bg-surface px-6 py-6">
      <Text className="mb-2 text-3xl font-bold text-text-primary">
        Continue your registration
      </Text>

      <Text className="mb-6 text-md text-text-secondary">
        Your progress has been saved. Continue where you left off.
      </Text>

      <View>
        {/* Current Step */}
        <View className="flex-row items-start gap-3 py-3 border-b border-border-primary/60">
          <MaterialCommunityIcons
            name="progress-pencil"
            size={22}
            color={theme.extends.colors.brand}
            style={{ marginTop: 2 }}
          />

          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary">
              Step {currentStep} of {totalSteps}
            </Text>

            <Text className="mt-1 text-sm leading-5 text-text-secondary">
              Continue completing your merchant application.
            </Text>
          </View>
        </View>

        {/* Progress */}
        <View className="py-4 border-b border-border-primary/60">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-bold text-text-primary">
              Progress
            </Text>

            <Text className="text-sm font-semibold text-brand">
              {Math.round(progress)}%
            </Text>
          </View>

          <View className="h-2 overflow-hidden rounded-full bg-border">
            <View
              className="h-full rounded-full bg-brand"
              style={{ width: `${progress}%` }}
            />
          </View>
        </View>

        {/* Last Updated */}
        <View className="flex-row items-start gap-3 py-3">
          <MaterialCommunityIcons
            name="history"
            size={22}
            color={theme.extends.colors.brand}
            style={{ marginTop: 2 }}
          />

          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary">
              Last updated
            </Text>

            <Text className="mt-1 text-sm leading-5 text-text-secondary">
              {lastUpdated}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
