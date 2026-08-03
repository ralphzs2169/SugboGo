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

import RegistrationStepContent from "../components/registration/RegistrationStepContent";
import { REGISTRATION_STEPS } from "../constants/registration/registrationSteps";

import ReviewCelebration from "../components/registration/ReviewCelebration";
import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "../constants/registration/defaultValues.constants";
import useRegistrationNavigation from "../hooks/registration/useRegistrationNavigation";
import { BackHandler } from "react-native";
import { useEffect } from "react";

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

  const STEP_ONE_FIELDS = [
    "businessName",
    "businessCluster",
    "businessCategory",
    "businessDescription",
    "contactNumber",
    "specialtyTags",
    "businessEmail",
    "website",
    "representativeName",
    "representativeRole",
  ] as const;

  const handleNext = async () => {
    const isLastStep = currentStep === REVIEW_STEP;

    if (isLastStep) {
      // submit later
      return;
    }

    // Returning to review after editing a section
    if (editingStep !== null) {
      goToReview();
      return;
    }

    if (currentStep === 5 && editingStep === null) {
      setShowReviewCelebration(true);
    }

    // if (currentStep === 1) {
    //   const isValid = await form.trigger(STEP_ONE_FIELDS);

    //   if (!isValid) {
    //     Toast.show({
    //       type: "error",
    //       text1: "Incomplete business information",
    //       text2: "Please review the highlighted fields before continuing.",
    //     });

    //     return;
    //   }
    // }

    // if (currentStep === 2) {
    //   const isValid = await form.trigger([
    //     "province",
    //     "city",
    //     "barangay",
    //     "streetAddress",
    //     "latitude",
    //     "longitude",
    //   ]);

    //   if (!isValid) {
    //     Toast.show({
    //       type: "error",
    //       text1: "Incomplete business location",
    //       text2:
    //         "Please select your business location and complete the address.",
    //     });

    //     return;
    //   }
    // }

    // if (currentStep === 3) {
    //   const isValid = await form.trigger("operatingHours");

    //   if (!isValid) {
    //     const operatingHoursError = form.formState.errors.operatingHours;

    //     const hasNoOpenDaysError =
    //       operatingHoursError?.message === "At least one day must be open.";

    //     Toast.show({
    //       type: "error",
    //       text1: hasNoOpenDaysError
    //         ? "No operating days selected"
    //         : "Check your operating hours",
    //       text2: hasNoOpenDaysError
    //         ? "Please select at least one day that your business is open."
    //         : "Please review the highlighted days before continuing.",
    //     });

    //     return;
    //   }
    // }

    // if (currentStep === 4) {
    //   const isValid = await form.trigger("businessPhotos");

    //   if (!isValid) {
    //     Toast.show({
    //       type: "error",
    //       text1: "Add a storefront photo",
    //       text2: "At least one storefront photo is required.",
    //     });

    //     return;
    //   }
    // }

    // if (currentStep === 5) {
    //   const isValid = await form.trigger("verificationDocuments");

    //   if (!isValid) {
    //     Toast.show({
    //       type: "error",
    //       text1: "Verification document required",
    //       text2:
    //         "Please upload your business registration document before continuing.",
    //     });
    //     return;
    //   }
    // }
    completeCurrentStep();
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
              onSaveAndReview={goToReview}
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
