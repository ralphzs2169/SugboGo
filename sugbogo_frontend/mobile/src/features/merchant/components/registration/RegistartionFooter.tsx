import Button from "@/shared/components/Button";
import { View } from "react-native";

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
 * Shows Back and Next actions, replacing Next with
 * Submit on the final step.
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
    <View className="mt-8 flex-row gap-3">
      {!isFirstStep && (
        <Button
          title="Back"
          variant="secondary"
          className="flex-1"
          onPress={onBack}
        />
      )}

      <Button
        title={isLastStep ? "Submit Application" : "Next"}
        className="flex-1"
        loading={isSubmitting}
        onPress={onNext}
      />
    </View>
  );
}
