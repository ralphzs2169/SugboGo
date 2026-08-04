import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const STEP_CIRCLE_SIZE = 36;
const CONNECTOR_HEIGHT = 2;

type RegistrationStepperProps = {
  currentStep: number;
  totalSteps: number;
  highestCompletedStep: number;
  editingStep: number | null;
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
  highestCompletedStep,
  editingStep,
  title,
}: RegistrationStepperProps) {
  return (
    <View className="bg-surface pb-4 pt-2 border-b border-border-primary">
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

          const isCurrent = step === currentStep;
          const isCompleted = !isCurrent && step <= highestCompletedStep;
          const isEditing = step === editingStep;

          return (
            <View key={step} className="relative flex-1 items-center">
              {/* Connector */}
              {step !== totalSteps && (
                <View
                  className={[
                    "absolute rounded-full",
                    step < highestCompletedStep
                      ? "bg-brand"
                      : "bg-border-primary",
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
              <View className="relative">
                {/* Current step glow */}
                {isCurrent && (
                  <View
                    className="absolute rounded-full bg-brand/10"
                    style={{
                      width: STEP_CIRCLE_SIZE + 14,
                      height: STEP_CIRCLE_SIZE + 14,
                      left: -7,
                      top: -7,
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
                        : "border-border-primary bg-surface",
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

                {isEditing && (
                  <View className="absolute -bottom-1 -right-1 z-20 h-5 w-5 items-center justify-center rounded-full bg-brand/90">
                    <MaterialCommunityIcons
                      name="pencil"
                      size={12}
                      color="#FFFFFF"
                    />
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
