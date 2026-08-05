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

import useSaveIdentity from "../hooks/registration/useSaveIdentity";
import useSaveLocation from "../hooks/registration/useSaveLocation";
import useSaveOperatingHours from "../hooks/registration/useSaveOperatingHours";
import useSaveApplicationPhotos from "../hooks/registration/useSaveApplicationPhotos";
import { ApplicationOperatingHoursPayload } from "../types/merchant-application/applicationApi.types";
import Toast from "react-native-toast-message";
import { handleSystemError } from "@/shared/utils/apiErrors";
import useSaveApplicationDocuments from "../hooks/registration/useSaveApplicationDocuments";
import { mapApplicationPhotos } from "../utils/mapApplicationPhotos.utils";
import { mapApplicationDocuments } from "../utils/mapApplicationDocuments.utils";

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

  const { saveIdentity, isSaving: isSavingIdentity } = useSaveIdentity();

  const { saveLocation, isSaving: isSavingLocation } = useSaveLocation();

  const { saveOperatingHours, isSaving: isSavingOperatingHours } =
    useSaveOperatingHours();

  const { savePhotos, isSaving: isSavingApplicationPhotos } =
    useSaveApplicationPhotos();
  const { saveDocuments, isSaving: isSavingApplicationDocuments } =
    useSaveApplicationDocuments();

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

  function appendPhotos(
    formData: FormData,
    category: string,
    photos: {
      uri: string;
      fileName?: string | null;
      mimeType?: string | null;
      id?: number;
    }[],
  ) {
    photos
      .filter((photo) => photo.id === undefined)
      .forEach((photo) => {
        formData.append(category, {
          uri: photo.uri,
          name: photo.fileName ?? `${category}.jpg`,
          type: photo.mimeType ?? "image/jpeg",
        } as any);
      });
  }

  const handleNext = async () => {
    if (currentStep === REVIEW_STEP) {
      // submit later
      return;
    }

    const isValid = await validateCurrentStep();

    if (!isValid) {
      return;
    }

    if (currentStep === 1) {
      const values = form.getValues();

      if (values.representativeRole === "") {
        return;
      }

      const response = await saveIdentity({
        business_name: values.businessName,
        business_description: values.businessDescription,
        contact_number: values.contactNumber,
        business_email: values.businessEmail,
        website: values.website,
        representative_name: values.representativeName,
        representative_role: values.representativeRole,
        business_cluster_id: Number(values.businessCluster),
        business_category_id: Number(values.businessCategory),
        specialty_tags: values.specialtyTags,
      });

      if (!response.success) {
        if (handleSystemError(response)) {
          return;
        }

        Toast.show({
          type: "error",
          text1: "Unable to save",
          text2: "We couldn't save your business identity. Please try again.",
        });
        return;
      }
    }

    // Save Step 2: Business Location
    if (currentStep === 2) {
      const values = form.getValues();

      if (values.latitude === null || values.longitude === null) {
        return;
      }

      const response = await saveLocation({
        province: values.province,
        city: values.city,
        barangay: values.barangay,
        street_address: values.streetAddress,
        unit: values.unit,
        latitude: values.latitude,
        longitude: values.longitude,
        landmarks: values.landmarks,
      });

      if (!response.success) {
        if (handleSystemError(response)) {
          return;
        }

        Toast.show({
          type: "error",
          text1: "Unable to save",
          text2: "We couldn't save your location. Please try again.",
        });
        return;
      }
    }

    // Save Step 3: Operating Hours
    if (currentStep === 3) {
      const values = form.getValues();

      const response = await saveOperatingHours({
        hours: Object.entries(values.operatingHours).map(([day, schedule]) => ({
          day: day as ApplicationOperatingHoursPayload["hours"][number]["day"],
          is_open: schedule.isOpen,
          is_24_hours: schedule.is24Hours,
          open_time: schedule.openTime || null,
          close_time: schedule.closeTime || null,
        })),
      });

      if (!response.success) {
        if (handleSystemError(response)) {
          return;
        }

        Toast.show({
          type: "error",
          text1: "Unable to save",
          text2: "We couldn't save your operating hours. Please try again.",
        });
        return;
      }
    }

    if (currentStep === 4) {
      const values = form.getValues();

      const hasNewPhotos =
        values.businessPhotos.storefront.some(
          (photo) => photo.id === undefined,
        ) ||
        values.businessPhotos.interior.some(
          (photo) => photo.id === undefined,
        ) ||
        values.businessPhotos.products.some(
          (photo) => photo.id === undefined,
        ) ||
        values.businessPhotos.additional.some(
          (photo) => photo.id === undefined,
        );

      if (hasNewPhotos) {
        const formData = new FormData();

        appendPhotos(formData, "storefront", values.businessPhotos.storefront);
        appendPhotos(formData, "interior", values.businessPhotos.interior);
        appendPhotos(formData, "products", values.businessPhotos.products);
        appendPhotos(formData, "additional", values.businessPhotos.additional);

        const response = await savePhotos(formData);
        console.log("PHOTO SAVE RESPONSE:", JSON.stringify(response, null, 2));

        if (!response.success) {
          Toast.show({
            type: "error",
            text1: "Unable to save",
            text2: "We couldn't save your business photos. Please try again.",
          });

          return;
        }

        form.setValue("businessPhotos", mapApplicationPhotos(response.data), {
          shouldDirty: false,
        });
      }
    }

    if (currentStep === 5) {
      const values = form.getValues();
      const formData = new FormData();

      const businessRegistration =
        values.verificationDocuments.businessRegistration;

      if (businessRegistration && businessRegistration.id === undefined) {
        formData.append("business_registration", {
          uri: businessRegistration.uri,
          name: businessRegistration.fileName ?? "business-registration",
          type: businessRegistration.mimeType ?? "application/pdf",
        } as any);
      }

      const authorizationDocument =
        values.verificationDocuments.authorizationDocument;

      if (authorizationDocument && authorizationDocument.id === undefined) {
        formData.append("authorization_document", {
          uri: authorizationDocument.uri,
          name: authorizationDocument.fileName ?? "authorization-document",
          type: authorizationDocument.mimeType ?? "application/pdf",
        } as any);
      }

      values.verificationDocuments.additionalDocuments
        .filter((document) => document.id === undefined)
        .forEach((document) => {
          formData.append("additional_documents", {
            uri: document.uri,
            name: document.fileName ?? "additional-document",
            type: document.mimeType ?? "application/pdf",
          } as any);
        });

      const response = await saveDocuments(formData);

      if (!response.success) {
        Toast.show({
          type: "error",
          text1: "Unable to save",
          text2:
            "We couldn't save your verification documents. Please try again.",
        });

        return;
      }

      form.setValue(
        "verificationDocuments",
        mapApplicationDocuments(response.data),
        {
          shouldDirty: false,
        },
      );
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
