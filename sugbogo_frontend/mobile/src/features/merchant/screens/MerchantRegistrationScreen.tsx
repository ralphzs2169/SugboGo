import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import RegistrationFooter from "../components/registration/RegistartionFooter";
import RegistrationLayout from "../components/registration/RegistrationLayout";
import RegistrationStepper from "../components/registration/RegistrationStepper";
import { merchantRegistrationSchema } from "../validation/merchantRegistration.schema";

import useCategories from "../hooks/registration/useCategories";
import useClusters from "../hooks/registration/useClusters";
import useRegistrationValidation from "../hooks/registration/useRegistrationValidation";
import RegistrationStepContent from "../components/registration/RegistrationStepContent";
import { REGISTRATION_STEPS } from "../constants/registration/registrationSteps";

import ReviewCelebration from "../components/registration/ReviewCelebration";
import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "../constants/registration/defaultValues.constants";
import useRegistrationNavigation from "../hooks/registration/useRegistrationNavigation";
import { BackHandler } from "react-native";
import { useEffect } from "react";

/**
 * Merchant registration wizard screen.
 *
 * Coordinates the overall merchant registration flow, including:
 * - Multi-step registration and persistent progress state.
 * - Form state and schema validation through React Hook Form and Zod.
 * - Cluster and category option loading.
 * - Step-specific validation before progressing.
 * - Review and edit-mode navigation.
 * - Android hardware back-button behavior.
 * - Review completion feedback.
 *
 * Navigation behavior:
 * - Normal steps progress sequentially after successful validation.
 * - Editing a completed section returns to Review after saving.
 * - Android Back while editing returns directly to Review.
 * - Android Back on the Review step is blocked because Review is
 *   the final checkpoint before submission.
 * - Android Back on earlier steps navigates to the previous step.
 *
 * Validation behavior: Each step is validated before leaving that step.
 */
export default function MerchantRegistrationScreen() {
  const REVIEW_STEP = REGISTRATION_STEPS.length;

  const {
    currentStep,
    editingStep,
    highestCompletedStep,
    scrollRef,
    goToReview,
    handleBack,
    handleEditSection,
    completeCurrentStep,
  } = useRegistrationNavigation({
    reviewStep: REVIEW_STEP,
  });

  const {
    clusters,
    isLoading: isLoadingClusters,
    error: clustersError,
    refetch: refetchClusters,
  } = useClusters();

  const {
    categories,
    isLoading: isLoadingCategories,
    error: categoriesError,
    refetch: refetchCategories,
  } = useCategories();

  const [showReviewCelebration, setShowReviewCelebration] = useState(false);

  const form = useForm<
    z.input<typeof merchantRegistrationSchema>,
    undefined,
    z.output<typeof merchantRegistrationSchema>
  >({
    resolver: zodResolver(merchantRegistrationSchema),
    defaultValues: MERCHANT_REGISTRATION_DEFAULT_VALUES,
  });

  const { validateCurrentStep } = useRegistrationValidation({
    currentStep,
    form,
  });

  const handleNext = async () => {
    if (currentStep === REVIEW_STEP) {
      // submit later
      return;
    }

    const isValid = await validateCurrentStep();

    if (!isValid) {
      return;
    }

    if (editingStep !== null) {
      goToReview();
      return;
    }

    if (currentStep === 5) {
      setShowReviewCelebration(true);
    }

    completeCurrentStep();
  };

  const handleSaveAndReview = async () => {
    const isValid = await validateCurrentStep();

    if (!isValid) {
      return;
    }

    goToReview();
  };

  useEffect(() => {
    /**
     * Handles Android hardware back navigation during merchant registration.
     *
     * Navigation behavior:
     * - Editing a section: return directly to the Review step.
     * - Review step: prevent navigating back into the registration flow.
     * - Normal registration steps: navigate to the previous step.
     * - First step: allow the default Android back behavior.
     */
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        // While editing a section, Android Back returns to Review.
        if (editingStep !== null) {
          goToReview();
          return true;
        }

        // Review is the final checkpoint.
        if (currentStep === REVIEW_STEP) {
          return true;
        }

        if (currentStep > 1) {
          handleBack();
          return true;
        }

        return false;
      },
    );

    return () => subscription.remove();
  }, [currentStep, editingStep, REVIEW_STEP, goToReview, handleBack]);

  return (
    <>
      <FormProvider {...form}>
        <RegistrationLayout
          scrollRef={scrollRef}
          stepper={
            <RegistrationStepper
              currentStep={currentStep}
              totalSteps={REVIEW_STEP}
              editingStep={editingStep}
              highestCompletedStep={highestCompletedStep}
              title={REGISTRATION_STEPS[currentStep - 1].title}
            />
          }
          footer={
            <RegistrationFooter
              currentStep={currentStep}
              totalSteps={REVIEW_STEP}
              onNext={handleNext}
              onBack={handleBack}
              isEditing={editingStep !== null}
              onSaveAndReview={handleSaveAndReview}
            />
          }

          overlay={showReviewCelebration ? <ReviewCelebration /> : null}
        >
          <RegistrationStepContent
            currentStep={currentStep}
            clusters={clusters}
            categories={categories}
            isLoadingClusters={isLoadingClusters}
            isLoadingCategories={isLoadingCategories}
            clustersError={clustersError}
            categoriesError={categoriesError}
            refetchClusters={refetchClusters}
            refetchCategories={refetchCategories}
            onEditSection={handleEditSection}
          />
        </RegistrationLayout>
      </FormProvider>
    </>
  );
}
