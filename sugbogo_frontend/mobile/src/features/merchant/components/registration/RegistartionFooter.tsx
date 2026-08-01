import Button from "@/shared/components/Button";
import { Text, View } from "react-native";

type RegistrationFooterProps = {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  isSubmitting?: boolean;
};

/**
 * Displays the navigation controls for the merchant
 * registration flow.
 *
 * Shows Back and Continue actions, replacing Continue with
 * Submit Application on the final step.
 */
export default function RegistrationFooter({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  isSubmitting = false,
}: RegistrationFooterProps) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <View className="border-t border-border-primary bg-surface px-6 py-5">
      {/* <Text className="mb-4 text-sm text-text-secondary">
        {isLastStep
          ? "Review your information before submitting your application."
          : "Complete each step to continue your merchant registration."}
      </Text> */}

      <View className="flex-row gap-3">
        {!isFirstStep && (
          <Button
            title="Back"
            variant="secondary"
            className="flex-1"
            disabled={isSubmitting}
            onPress={onBack}
          />
        )}

        <Button
          title={isLastStep ? "Submit Application" : "Continue"}
          className="flex-1"
          loading={isSubmitting}
          disabled={isSubmitting}
          onPress={onNext}
        />
      </View>
    </View>
  );
}
