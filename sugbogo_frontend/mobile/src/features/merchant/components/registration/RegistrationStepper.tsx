import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const STEP_CIRCLE_SIZE = 36;
const CONNECTOR_HEIGHT = 2;

type RegistrationStepperProps = {
  currentStep: number;
  totalSteps: number;
  title: string;
};

const STEP_ICONS = [
  "storefront-outline",
  "map-marker-outline",
  "clock-outline",
  "image-outline",
  "file-document-outline",
  "clipboard-check-outline",
] as const;
/**
 * Displays the user's progress through the merchant
 * registration flow.
 *
 * Completed steps display a checkmark, the current step is
 * highlighted, and upcoming steps remain muted.
 */
export default function RegistrationStepper({
  currentStep,
  totalSteps,
  title,
}: RegistrationStepperProps) {
  return (
    <View className="bg-surface pb-4 pt-2 border-b border-border">
      <Text
        className="mb-4 text-sm font-medium text-text-secondary"
        style={{ marginLeft: STEP_CIRCLE_SIZE / 2 }}
      >
        Step {currentStep} of {totalSteps}
        <Text className="text-text-tertiary"> • </Text>
        <Text className="font-semibold text-text-primary">{title}</Text>
      </Text>

      <View className="flex-row items-center">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const step = index + 1;

          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;

          return (
            <View key={step} className="relative flex-1 items-center">
              {/* Connector */}
              {step !== totalSteps && (
                <View
                  className={[
                    "absolute rounded-full",
                    step < currentStep ? "bg-brand" : "bg-border",
                  ].join(" ")}
                  style={{
                    left: STEP_CIRCLE_SIZE / 2,
                    right: -(STEP_CIRCLE_SIZE / 2),
                    top: STEP_CIRCLE_SIZE / 2 - CONNECTOR_HEIGHT / 2,
                    height: CONNECTOR_HEIGHT,
                  }}
                />
              )}

              {/* Circle */}
              <View
                style={{
                  width: STEP_CIRCLE_SIZE,
                  height: STEP_CIRCLE_SIZE,
                }}
                className={[
                  "z-10 items-center justify-center rounded-full border-2",
                  isCompleted
                    ? "border-brand bg-brand"
                    : isCurrent
                      ? "border-brand bg-white"
                      : "border-border bg-surface",
                ].join(" ")}
              >
                {isCompleted ? (
                  <MaterialCommunityIcons
                    name="check"
                    size={18}
                    color="white"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name={STEP_ICONS[index]}
                    size={18}
                    color={isCurrent ? "#F27F0D" : "#6B7280"}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
