import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import RegistrationFooter from "../components/registration/RegistartionFooter";
import RegistrationLayout from "../components/registration/RegistrationLayout";
import RegistrationStepper from "../components/registration/RegistrationStepper";
import {
  MerchantRegistrationForm,
  merchantRegistrationSchema,
} from "../validation/merchantRegistration.schema";

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
import {
  ApplicationIdentityPayload,
  ApplicationLocationPayload,
  ApplicationOperatingHoursPayload,
} from "../types/registration/registrationApi.types";
import Toast from "react-native-toast-message";
import { handleSystemError } from "@/shared/utils/apiErrors";
import useSaveApplicationDocuments from "../hooks/registration/useSaveApplicationDocuments";
import { mapApplicationPhotos } from "../utils/merchant-application/mappers/mapApplicationPhotos.utils";
import { mapApplicationDocuments } from "../utils/merchant-application/mappers/mapApplicationDocuments.utils";
import { hasIdentityChanged } from "../utils/merchant-application/comparisons/hasIdentityChanged.utils";
import { buildIdentityPayload } from "../utils/merchant-application/builders/buildIdentityPayload.utils";
import { hasLocationChanged } from "../utils/merchant-application/comparisons/hasLocationChanged.utils";
import { buildLocationPayload } from "../utils/merchant-application/builders/buildLocationPayload.utils";
import { useMerchantRegistrationStore } from "../stores/merchantRegistrationStore";
import { hasOperatingHoursChanged } from "../utils/merchant-application/comparisons/hasOperatingHoursChanged.utils";
import { detectPhotoChanges } from "../utils/merchant-application/comparisons/detectPhotoChanges.utils";
import { detectDocumentChanges } from "../utils/merchant-application/comparisons/detectDocumentChanges.utils";
import useSubmitApplication from "../hooks/registration/useSubmitApplication";
import { router } from "expo-router";
import useCurrentApplication from "../hooks/registration/useCurrentApplication";
import { mapApplicationToForm } from "@/features/merchant/utils/merchant-application/mappers/mapApplicationToForm.utils";
import buildOperatingHoursPayload from "../utils/merchant-application/builders/buildOperatingHoursPayload.utils";
import LoadingScreen from "@/shared/components/LoadingScreen";
import { mapApplicationToStore } from "../utils/merchant-application/mappers/mapApplicationToStore.utils";
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

    setCurrentStep,
    setHighestCompletedStep,
  } = useRegistrationNavigation({
    reviewStep: REVIEW_STEP,
    onBeforeBack: (step) => {
      if (step === 2) {
        persistCurrentAddress();
      }
    },
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

  const { application, isLoading: isLoadingApplication } =
    useCurrentApplication();

  const { saveIdentity, isSaving: isSavingIdentity } = useSaveIdentity();

  const { saveLocation, isSaving: isSavingLocation } = useSaveLocation();

  const { saveOperatingHours, isSaving: isSavingOperatingHours } =
    useSaveOperatingHours();

  const { savePhotos, isSaving: isSavingApplicationPhotos } =
    useSaveApplicationPhotos();
  const { saveDocuments, isSaving: isSavingApplicationDocuments } =
    useSaveApplicationDocuments();

  const { submit, isSubmitting: isSubmittingApplication } =
    useSubmitApplication();

  const [showReviewCelebration, setShowReviewCelebration] = useState(false);

  const setSelectedAddress = useMerchantRegistrationStore(
    (state) => state.setSelectedAddress,
  );
  const setSelectedLocation = useMerchantRegistrationStore(
    (state) => state.setSelectedLocation,
  );

  const setSelectedLandmarks = useMerchantRegistrationStore(
    (state) => state.setSelectedLandmarks,
  );

  const hasInitialized = useRef(false);

  const isSavingCurrentStep =
    isSavingIdentity ||
    isSavingLocation ||
    isSavingOperatingHours ||
    isSavingApplicationPhotos ||
    isSavingApplicationDocuments;

  // Last Saved States
  const [lastSavedIdentity, setLastSavedIdentity] =
    useState<ApplicationIdentityPayload | null>(null);

  const [lastSavedLocation, setLastSavedLocation] =
    useState<ApplicationLocationPayload | null>(null);

  const [lastSavedOperatingHours, setLastSavedOperatingHours] =
    useState<ApplicationOperatingHoursPayload | null>(null);

  const [lastSavedPhotos, setLastSavedPhotos] = useState<
    MerchantRegistrationForm["businessPhotos"] | null
  >(null);

  const [lastSavedDocuments, setLastSavedDocuments] = useState<
    MerchantRegistrationForm["verificationDocuments"] | null
  >(null);

  // Form state and validation
  const form = useForm<
    z.input<typeof merchantRegistrationSchema>,
    undefined,
    z.output<typeof merchantRegistrationSchema>
  >({
    resolver: zodResolver(merchantRegistrationSchema),
    defaultValues: MERCHANT_REGISTRATION_DEFAULT_VALUES,
  });

  // Persist the current address in the registration store when leaving Step 2.
  const persistCurrentAddress = () => {
    const values = form.getValues();

    setSelectedAddress({
      province: values.province,
      city: values.city,
      barangay: values.barangay,
      streetAddress: values.streetAddress,
      unit: values.unit,
    });
  };

  useEffect(() => {
    if (!application || hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;

    const values = mapApplicationToForm(application);
    const store = mapApplicationToStore(application);

    form.reset(values);

    if (store.selectedLocation) {
      setSelectedLocation(store.selectedLocation);
    }

    if (store.selectedAddress) {
      setSelectedAddress(store.selectedAddress);
    }

    setSelectedLandmarks(store.selectedLandmarks);

    setCurrentStep(application.highest_completed_step);
    setHighestCompletedStep(application.highest_completed_step);

    setLastSavedIdentity(buildIdentityPayload(values));
    setLastSavedLocation(buildLocationPayload(values));

    setLastSavedOperatingHours(buildOperatingHoursPayload(values));

    setLastSavedPhotos(values.businessPhotos);

    setLastSavedDocuments(values.verificationDocuments);
  }, [application]);

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

  /**
   * Validates and persists the current registration step.
   *
   * Saves only when changes are detected and updates the corresponding
   * local "last saved" state after a successful response.
   *
   * Returns `true` when the step is valid and successfully saved (or
   * when there are no changes), otherwise returns `false`.
   */
  const saveCurrentStep = async (): Promise<boolean> => {
    const isValid = await validateCurrentStep();

    if (!isValid) {
      return false;
    }

    if (currentStep === 1) {
      const values = form.getValues();

      const payload = buildIdentityPayload(values);

      if (hasIdentityChanged(lastSavedIdentity, payload)) {
        const response = await saveIdentity(payload);

        if (!response.success) {
          return false;
        }

        setLastSavedIdentity(payload);
      }
    }

    // Save Step 2: Business Location
    if (currentStep === 2) {
      const values = form.getValues();

      if (values.latitude === null || values.longitude === null) {
        return false;
      }

      const payload = buildLocationPayload(values);

      if (hasLocationChanged(lastSavedLocation, payload)) {
        const response = await saveLocation(payload);

        if (!response.success) {
          return false;
        }

        setLastSavedLocation(payload);
      }
    }

    // Save Step 3: Operating Hours
    if (currentStep === 3) {
      const values = form.getValues();

      const payload = buildOperatingHoursPayload(values);

      if (hasOperatingHoursChanged(lastSavedOperatingHours, payload)) {
        const response = await saveOperatingHours(payload);

        if (!response.success) {
          return false;
        }

        setLastSavedOperatingHours(payload);
      }
    }

    if (currentStep === 4) {
      const values = form.getValues();

      const { hasChanges, deletedPhotoIds } = detectPhotoChanges(
        lastSavedPhotos,
        values.businessPhotos,
      );

      if (hasChanges) {
        const formData = new FormData();

        appendPhotos(formData, "storefront", values.businessPhotos.storefront);
        appendPhotos(formData, "interior", values.businessPhotos.interior);
        appendPhotos(formData, "products", values.businessPhotos.products);
        appendPhotos(formData, "additional", values.businessPhotos.additional);

        deletedPhotoIds.forEach((id) => {
          formData.append("deleted_photo_ids", String(id));
        });

        const response = await savePhotos(formData);

        if (!response.success) {
          return false;
        }

        const savedPhotos = mapApplicationPhotos(response.data);

        form.setValue("businessPhotos", savedPhotos, {
          shouldDirty: false,
        });

        setLastSavedPhotos(savedPhotos);
      }
    }

    if (currentStep === 5) {
      const values = form.getValues();

      const { hasChanges, deletedDocumentIds } = detectDocumentChanges(
        lastSavedDocuments,
        values.verificationDocuments,
      );

      if (!hasChanges) {
        return true;
      }

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

      deletedDocumentIds.forEach((id) => {
        formData.append("deleted_document_ids", String(id));
      });

      const response = await saveDocuments(formData);

      if (!response.success) {
        return false;
      }

      const savedDocuments = mapApplicationDocuments(response.data);

      form.setValue("verificationDocuments", savedDocuments, {
        shouldDirty: false,
      });

      setLastSavedDocuments(savedDocuments);
    }

    return true;
  };

  /**
   * Saves the current step and advances to the next step.
   *
   * Displays the completion celebration after Step 5 before moving
   * to the review screen.
   */
  const handleNext = async () => {
    if (currentStep === REVIEW_STEP) {
      const result = await submit();

      if (!result.success) {
        return;
      }

      router.replace("/(explorer)/merchant-registration/submission-success");
      return;
    }
    const success = await saveCurrentStep();

    if (!success) {
      return;
    }

    if (currentStep === 2) {
      persistCurrentAddress();
    }

    if (currentStep === 5) {
      setShowReviewCelebration(true);
    }

    completeCurrentStep();
  };

  /**
   * Saves the current step and navigates directly to the review page.
   *
   * Used when editing an existing section from the review screen.
   */
  const handleSaveAndReview = async () => {
    if (currentStep === 2) {
      persistCurrentAddress();
    }

    const success = await saveCurrentStep();

    if (!success) {
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

  if (isLoadingApplication) {
    return (
      <LoadingScreen
        title="Restoring your progress"
        description="Loading your saved registration details..."
      />
    );
  }

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
              isSubmitting={isSavingCurrentStep}
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
