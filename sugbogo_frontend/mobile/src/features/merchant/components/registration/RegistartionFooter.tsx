import Button from "@/shared/components/Button";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
type RegistrationFooterProps = {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSaveAndReview: () => void;
  isSubmitting?: boolean;
  isEditing?: boolean;
  isResubmission: boolean;
  canResubmit?: boolean;
};

/**
 * Renders the navigation actions for the merchant registration flow.
 *
 * The footer supports three states:
 * - Normal registration: Back + Continue
 * - First step: Continue only
 * - Editing a previously completed step: Save & Review only
 *
 * The final Review step hides Back because merchants can navigate to a
 * specific section through the review screen's edit actions instead.
 */
export default function RegistrationFooter({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSaveAndReview,
  isSubmitting = false,
  isEditing = false,
  isResubmission,
  canResubmit = true,
}: RegistrationFooterProps) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  /*
   * When editing an existing section, the footer intentionally replaces
   * normal step navigation with a single action that returns the merchant
   * to the Review step after saving their changes.
   */
  if (isEditing) {
    return (
      <View className="border-t border-border-primary bg-surface px-6 py-5">
        <Button
          title="Save & Review"
          className="w-full"
          fontClassName="font-bold"
          loading={isSubmitting}
          disabled={isSubmitting}
          onPress={onSaveAndReview}
        />
      </View>
    );
  }

  const primaryButtonTitle = isLastStep
    ? isResubmission
      ? "Resubmit Application"
      : "Submit Application"
    : "Save & Continue";

  return (
    <View className="border-t border-border-primary bg-surface px-6 py-5">
      <View className="flex-row gap-3">
        {!isFirstStep && !isLastStep && (
          <Button
            title="Back"
            variant="soft"
            className="flex-[0.8]"
            disabled={isSubmitting}
            onPress={onBack}
          />
        )}

        <Button
          title={primaryButtonTitle}
          className={!isFirstStep && !isLastStep ? "flex-[1.2]" : "flex-1"}
          loading={isSubmitting}
          disabled={isSubmitting || (isResubmission && !canResubmit)}
          onPress={onNext}
          fontClassName="font-bold"
          icon={
            !isLastStep ? (
              <MaterialCommunityIcons
                name="arrow-right"
                size={20}
                color="white"
              />
            ) : undefined
          }
        />
      </View>
    </View>
  );
}
