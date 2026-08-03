import Button from "@/shared/components/Button";
import { View } from "react-native";

type RegistrationFooterProps = {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSaveAndReview: () => void;
  isSubmitting?: boolean;
  isEditing?: boolean;
};

export default function RegistrationFooter({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSaveAndReview,
  isSubmitting = false,
  isEditing = false,
}: RegistrationFooterProps) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;
  console.log(isEditing, "isEditing");
  if (isEditing) {
    return (
      <View className="border-t border-border-primary bg-surface px-6 py-5">
        <Button
          title="Save & Review"
          className="w-full"
          loading={isSubmitting}
          disabled={isSubmitting}
          onPress={onSaveAndReview}
        />
      </View>
    );
  }

  return (
    <View className="border-t border-border-primary bg-surface px-6 py-5">
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
