import { Text, View } from "react-native";

type RegistrationProgressCardProps = {
  currentStep: number;
  totalSteps: number;
  lastUpdated: string;
};

/**
 * Displays the user's current merchant registration progress.
 *
 * Used while an application is in the draft state to show
 * completion progress and the last saved timestamp.
 */
export default function RegistrationProgressCard({
  currentStep,
  totalSteps,
  lastUpdated,
}: RegistrationProgressCardProps) {
  const progress = currentStep / totalSteps;

  return (
    <View className="mx-6 mt-6 rounded-2xl bg-card p-5">
      <Text className="text-lg font-bold text-foreground">
        Registration Progress
      </Text>

      <Text className="mt-3 text-base text-muted-foreground">
        Step {currentStep} of {totalSteps}
      </Text>

      <View className="mt-4 h-3 overflow-hidden rounded-full bg-border">
        <View
          className="h-full rounded-full bg-brand"
          style={{
            width: `${progress * 100}%`,
          }}
        />
      </View>

      <Text className="mt-5 text-sm font-semibold text-muted-foreground">
        Last updated
      </Text>

      <Text className="mt-1 text-base text-foreground">{lastUpdated}</Text>
    </View>
  );
}
