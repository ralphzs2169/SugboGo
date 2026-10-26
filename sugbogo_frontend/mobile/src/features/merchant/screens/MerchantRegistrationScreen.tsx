import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import RegistrationFooter from "../components/registration/RegistartionFooter";
import RegistrationLayout from "../components/registration/RegistrationLayout";
import RegistrationStepper from "../components/registration/RegistrationStepper";
import {
  MerchantRegistrationForm,
  merchantRegistrationSchema,
} from "../validation/merchantRegistration.schema";

import RegistrationStepContent from "../components/registration/RegistrationStepContent";
import { REGISTRATION_STEPS } from "../constants/registration/registrationSteps";
import useCategories from "../hooks/registration/useCategories";
import useClusters from "../hooks/registration/useClusters";
import useRegistrationValidation from "../hooks/registration/useRegistrationValidation";

import { BackHandler, Keyboard, Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import ReviewCelebration from "../components/registration/ReviewCelebration";
import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "../constants/registration/defaultValues.constants";
import useRegistrationNavigation from "../hooks/registration/useRegistrationNavigation";

import { mapApplicationToForm } from "@/features/merchant/utils/merchant-application/mappers/mapApplicationToForm.utils";
import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import useCurrentApplication from "../hooks/registration/useCurrentApplication";
import useSaveApplicationDocuments from "../hooks/registration/useSaveApplicationDocuments";
import useSaveApplicationPhotos from "../hooks/registration/useSaveApplicationPhotos";
import useSaveIdentity from "../hooks/registration/useSaveIdentity";
import useSaveLocation from "../hooks/registration/useSaveLocation";
import useSaveOperatingHours from "../hooks/registration/useSaveOperatingHours";
import useSubmitApplication from "../hooks/registration/useSubmitApplication";
import { useMerchantRegistrationStore } from "../stores/merchantRegistrationStore";
import { ApplicationDetailResponse } from "../types/registration/registrationApi.types";
import { buildIdentityPayload } from "../utils/merchant-application/builders/buildIdentityPayload.utils";
import { buildLocationPayload } from "../utils/merchant-application/builders/buildLocationPayload.utils";
import buildOperatingHoursPayload from "../utils/merchant-application/builders/buildOperatingHoursPayload.utils";
import { getDocumentChanges } from "../utils/merchant-application/comparisons/getDocumentChanges.utils";
import { getPhotoChanges } from "../utils/merchant-application/comparisons/getPhotoChanges.utils";
import { hasIdentityChanged } from "../utils/merchant-application/comparisons/hasIdentityChanged.utils";
import { hasLocationChanged } from "../utils/merchant-application/comparisons/hasLocationChanged.utils";
import { shouldSaveOperatingHours } from "../utils/merchant-application/comparisons/hasOperatingHoursChanged.utils";
import { mapApplicationDocuments } from "../utils/merchant-application/mappers/mapApplicationDocuments.utils";
import { mapApplicationPhotos } from "../utils/merchant-application/mappers/mapApplicationPhotos.utils";
import { mapApplicationToStore } from "../utils/merchant-application/mappers/mapApplicationToStore.utils";

import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import { buildDocumentUploadFormData } from "../utils/merchant-application/builders/buildDocumentUploadFormData.utils";
import { buildPhotoUploadFormData } from "../utils/merchant-application/builders/buildPhotoUploadFormData.utils";
import { getUnsavedSections } from "../utils/merchant-application/comparisons/getUnsavedSections.utils";
import DiscardChangesMessage from "../utils/merchant-application/discardChangesMessage.utils";

import {
  NormalizedIdentity,
  normalizeIdentity,
} from "../utils/merchant-application/normalizers/normalizeIdentity.utils";
import {
  NormalizedLocation,
  normalizeLocation,
} from "../utils/merchant-application/normalizers/normalizeLocation.utils";
import {
  NormalizedOperatingHours,
  normalizeOperatingHours,
} from "../utils/merchant-application/normalizers/normalizeOperatingHours.utils";
import useRegistrationErrorScroll from "../hooks/registration/useRegistrationErrorScroll";
import Toast from "react-native-toast-message";
import useRegistrationUnsavedChanges from "../hooks/registration/useRegistrationUnsavedChanges";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";

const SECTION_FIELDS = [
  [
    "businessName",
    "businessCluster",
    "businessCategory",
    "businessDescription",
    "specialtyTags",
    "representativeName",
    "representativeRole",
    "contactNumber",
    "businessEmail",
    "website",
  ],
  [
    "province",
    "city",
    "barangay",
    "streetAddress",
    "unit",
    "landmarks",
    "latitude",
    "longitude",
  ],
  ["operatingHours"],
  ["businessPhotos"],
  ["verificationDocuments"],
] as const;

/** Keeps the form and its restoration checkpoint local to one account session. */
export default function MerchantRegistrationScreen() {
  const ownerId = useAuthStore((state) => state.user?.id);
  const generation = useSyncExternalStore(
    subscribeAuthSessionChanges,
    getAuthSessionGeneration,
  );

  return <MerchantRegistrationFormScreen key={`${ownerId}:${generation}`} />;
}

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
 * - Footer and Android Back return section edits to Review, confirming discard.
 * - The header explicitly exits registration; Review exits preserve saved details.
 * - Android Back on earlier steps navigates to the previous step.
 *
 * Validation behavior: Each step is validated before leaving that step.
 */
function MerchantRegistrationFormScreen() {
  const [session] = useState(() => ({
    ownerId: useAuthStore.getState().user?.id,
    generation: getAuthSessionGeneration(),
  }));
  // -- Navigation
  const REVIEW_STEP = REGISTRATION_STEPS.length;
  const navigation = useNavigation();
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

    // Persist the current address in the registration store when leaving Step 2.
    onBeforeBack: (step) => {
      if (step === 2) {
        persistCurrentAddress();
      }
    },
  });

  // Data Queries
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
  const {
    application,
    isLoading: isLoadingApplication,
    error: applicationError,
    refetch: refetchApplication,
  } = useCurrentApplication();

  // Administrator feedback
  const feedback = application?.latest_review?.feedback ?? [];

  const isResubmission = application?.status === "rejected";
  const canResubmit =
    !isResubmission || feedback.every((item) => item.is_changed);

  // Mutations
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

  const [showDiscardChangesModal, setShowDiscardChangesModal] = useState(false);
  const [showLeaveReviewModal, setShowLeaveReviewModal] = useState(false);
  const [showReviewCelebration, setShowReviewCelebration] = useState(false);

  const [restoreError, setRestoreError] = useState(false);
  const [reviewValues, setReviewValues] = useState(
    MERCHANT_REGISTRATION_DEFAULT_VALUES,
  );

  const [unsavedSections, setUnsavedSections] = useState<string[]>([]);

  const { registerErrorScrollTarget, scrollToFirstError } =
    useRegistrationErrorScroll({
      scrollRef,
      currentStep,
    });

  // Merchant Registration Store to persist selected location, address, and landmarks across steps.
  const setSelectedAddress = useMerchantRegistrationStore(
    (state) => state.setSelectedAddress,
  );
  const resetMerchantRegistrationStore = useMerchantRegistrationStore(
    (state) => state.reset,
  );

  // Local State
  const hasRestoredDraft = useRef(false);

  /**
   * Stores the navigation action that should run after
   * the user confirms discarding their unsaved changes.
   */
  const pendingExitAction = useRef<(() => void) | null>(null);
  const savingRef = useRef(false);
  const allowRemoval = useRef(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const savedValues = useRef(
    structuredClone(MERCHANT_REGISTRATION_DEFAULT_VALUES),
  );
  const savedLocationSelection = useRef<
    ReturnType<typeof mapApplicationToStore>
  >({
    selectedLocation: null,
    selectedAddress: null,
    selectedLandmarks: [],
  });

  const isSavingCurrentStep =
    isPersisting ||
    isSavingIdentity ||
    isSavingLocation ||
    isSavingOperatingHours ||
    isSavingApplicationPhotos ||
    isSavingApplicationDocuments ||
    isSubmittingApplication;

  // Last Saved Snapshots
  const [lastSavedIdentity, setLastSavedIdentity] =
    useState<NormalizedIdentity | null>(null);

  const [lastSavedLocation, setLastSavedLocation] =
    useState<NormalizedLocation | null>(null);

  const [lastSavedOperatingHours, setLastSavedOperatingHours] =
    useState<NormalizedOperatingHours | null>(null);

  const [lastSavedPhotos, setLastSavedPhotos] = useState<
    MerchantRegistrationForm["businessPhotos"] | null
  >(null);

  const [lastSavedDocuments, setLastSavedDocuments] = useState<
    MerchantRegistrationForm["verificationDocuments"] | null
  >(null);

  // Form
  const form = useForm<
    z.input<typeof merchantRegistrationSchema>,
    undefined,
    z.output<typeof merchantRegistrationSchema>
  >({
    resolver: zodResolver(merchantRegistrationSchema),
    defaultValues: MERCHANT_REGISTRATION_DEFAULT_VALUES,
    disabled: isSavingCurrentStep,
  });

  const hasUnsavedChanges = useRegistrationUnsavedChanges(form.control, {
    lastSavedIdentity,
    lastSavedLocation,
    lastSavedOperatingHours,
    lastSavedPhotos,
    lastSavedDocuments,
  });

  // Helper Functions

  const requestExit = useCallback(
    (action: () => void, confirmReview = false) => {
      if (
        savingRef.current ||
        isSavingCurrentStep ||
        pendingExitAction.current
      ) {
        return;
      }
      const sections = getUnsavedSections({
        values: form.getValues(),
        lastSavedIdentity,
        lastSavedLocation,
        lastSavedOperatingHours,
        lastSavedPhotos,
        lastSavedDocuments,
      });

      if (sections.length === 0) {
        if (confirmReview) {
          pendingExitAction.current = action;
          setShowLeaveReviewModal(true);
        } else {
          action();
        }
        return;
      }

      setUnsavedSections(sections);
      pendingExitAction.current = action;
      setShowDiscardChangesModal(true);
    },
    [
      form,
      lastSavedIdentity,
      lastSavedLocation,
      lastSavedOperatingHours,
      lastSavedPhotos,
      lastSavedDocuments,
      setShowDiscardChangesModal,
      setUnsavedSections,
      setShowLeaveReviewModal,
      isSavingCurrentStep,
    ],
  );

  const handleDiscardChanges = () => {
    if (!isCurrentSession() || savingRef.current || isSavingCurrentStep) {
      return;
    }
    const action = pendingExitAction.current;
    pendingExitAction.current = null;
    setShowDiscardChangesModal(false);
    action?.();
  };

  const isCurrentSession = useCallback(() => {
    const auth = useAuthStore.getState();
    return (
      auth.isAuthenticated &&
      auth.user?.id === session.ownerId &&
      isAuthSessionCurrent(session.generation)
    );
  }, [session]);

  const leaveRegistration = useCallback(
    (action: () => void) => {
      if (!isCurrentSession()) {
        return;
      }
      allowRemoval.current = true;
      resetMerchantRegistrationStore();
      action();
    },
    [resetMerchantRegistrationStore, isCurrentSession],
  );

  // This is Expo Router's own navigation hook, including native-stack gesture support.
  usePreventRemove(
    isCurrentSession() && (hasUnsavedChanges || isSavingCurrentStep),
    ({ data }) => {
      if (!isCurrentSession() || allowRemoval.current) {
        navigation.dispatch(data.action);
        return;
      }
      requestExit(() =>
        leaveRegistration(() => navigation.dispatch(data.action)),
      );
    },
  );

  /** Routes review exits through saved-data confirmation or the existing unsaved-change guard. */
  const requestReviewExit = useCallback(() => {
    if (isSavingCurrentStep) {
      return;
    }
    requestExit(
      () =>
        leaveRegistration(() =>
          router.dismissTo("/(explorer)/profile/merchant-portal"),
        ),
      true,
    );
  }, [isSavingCurrentStep, requestExit, leaveRegistration]);

  /** Leaves review without deleting saved application details, rechecking local edits first. */
  const exitReviewToPortal = () => {
    if (!isCurrentSession() || savingRef.current || isSavingCurrentStep) {
      return;
    }
    setShowLeaveReviewModal(false);
    const action = pendingExitAction.current;
    pendingExitAction.current = null;
    action?.();
  };
  // Persist the current address in the registration store when leaving Step 2.
  const persistCurrentAddress = (values = form.getValues()) => {
    const auth = useAuthStore.getState();
    if (
      !auth.isAuthenticated ||
      auth.user?.id !== session.ownerId ||
      !isAuthSessionCurrent(session.generation)
    ) {
      return;
    }

    setSelectedAddress({
      province: values.province,
      city: values.city,
      barangay: values.barangay,
      streetAddress: values.streetAddress,
      unit: values.unit,
    });
  };

  // Set the header back button on the navigation options.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit registration"
          disabled={isSavingCurrentStep}
          className="min-h-12 min-w-12 cursor-pointer items-center justify-center active:opacity-70"
          onPress={() => {
            if (currentStep === REVIEW_STEP) {
              requestReviewExit();
              return;
            }
            requestExit(() => leaveRegistration(() => router.back()));
          }}
        >
          <MaterialCommunityIcons
            name="close"
            size={28}
            color={theme.extends.colors.text.primary}
          />
        </Pressable>
      ),
    });
  }, [
    navigation,
    requestExit,
    requestReviewExit,
    currentStep,
    REVIEW_STEP,
    isSavingCurrentStep,
    leaveRegistration,
  ]);

  /**
   * Restores a previously saved merchant application.
   *
   * Initializes the registration form, merchant registration store,
   * navigation state, and last-saved snapshots used for change
   * detection when resuming an existing draft.
   */
  const restoreDraft = useCallback(
    (application: ApplicationDetailResponse): boolean => {
      try {
        const values = mapApplicationToForm(application);
        const store = mapApplicationToStore(application);

        form.reset(values);
        setReviewValues(values);
        savedValues.current = structuredClone(values);
        savedLocationSelection.current = structuredClone(store);

        // Replace the full authoritative snapshot, including absent values and flags.
        resetMerchantRegistrationStore();
        useMerchantRegistrationStore.setState(store);

        // Set the current step to the next incomplete step, but do not exceed the Review step.
        setCurrentStep(
          Math.min(application.highest_completed_step + 1, REVIEW_STEP),
        );
        setHighestCompletedStep(application.highest_completed_step);

        // Initialize the last-saved snapshots for change detection
        setLastSavedIdentity(normalizeIdentity(values));
        setLastSavedLocation(normalizeLocation(values));

        if (application.operating_hours.length > 0) {
          setLastSavedOperatingHours(normalizeOperatingHours(values));
        } else {
          setLastSavedOperatingHours(null);
        }

        setLastSavedPhotos(values.businessPhotos);
        setLastSavedDocuments(values.verificationDocuments);

        setRestoreError(false);

        if (application.status === "draft") {
          Toast.show({
            type: "success",
            text1: "Draft restored",
            text2: "Your saved registration draft has been restored.",
          });
        }

        return true;
      } catch (error) {
        console.error("Failed to restore merchant application:", error);
        setRestoreError(true);

        return false;
      }
    },
    [
      form,
      resetMerchantRegistrationStore,
      REVIEW_STEP,
      setCurrentStep,
      setHighestCompletedStep,
      setLastSavedIdentity,
      setLastSavedLocation,
      setLastSavedOperatingHours,
      setLastSavedPhotos,
      setLastSavedDocuments,
      setRestoreError,
      setReviewValues,
    ],
  );

  /**
   * Restores the user's saved merchant application once after
   * the application has been loaded.
   */
  useEffect(() => {
    const auth = useAuthStore.getState();
    if (
      !auth.isAuthenticated ||
      auth.user?.id !== session.ownerId ||
      !isAuthSessionCurrent(session.generation) ||
      isLoadingApplication ||
      (applicationError && !application) ||
      hasRestoredDraft.current
    ) {
      return;
    }

    if (!application) {
      resetMerchantRegistrationStore();
      hasRestoredDraft.current = true;
      return;
    }

    // One-time server hydration must initialize the form and its saved snapshots together.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const restored = restoreDraft(application);

    if (restored) {
      hasRestoredDraft.current = true;
    }
  }, [
    application,
    applicationError,
    isLoadingApplication,
    resetMerchantRegistrationStore,
    restoreDraft,
    session,
  ]);

  const { validateCurrentStep } = useRegistrationValidation({
    currentStep,
    form,
  });

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

    if (!isCurrentSession()) {
      return false;
    }

    if (!isValid) {
      scrollToFirstError(() => form.formState.errors);
      return false;
    }

    const submittedValues = structuredClone(form.getValues());
    let values = structuredClone(submittedValues);
    const fields = SECTION_FIELDS[currentStep - 1] ?? [];
    const isSameRevision = () =>
      fields.every(
        (field) =>
          JSON.stringify(form.getValues(field)) ===
          JSON.stringify(submittedValues[field]),
      );
    const applySavedSection = (mapped: typeof values) => {
      for (const field of fields) {
        values = { ...values, [field]: mapped[field] };
      }
    };
    const emptySections = {
      identity: null,
      location: null,
      operating_hours: [],
      photos: [],
      documents: [],
    };

    // Save Step 1: Business Identity
    if (currentStep === 1) {
      const currentIdentity = normalizeIdentity(values);

      if (hasIdentityChanged(lastSavedIdentity, currentIdentity)) {
        let payload: ReturnType<typeof buildIdentityPayload>;

        try {
          payload = buildIdentityPayload(values);
        } catch (error) {
          console.error("Failed to build business identity payload:", error);

          Toast.show({
            type: "error",
            text1: "Unable to save changes",
            text2:
              "Something went wrong while preparing your business information.",
          });

          return false;
        }

        const response = await saveIdentity(payload);

        if (!isCurrentSession() || !response.success) {
          return false;
        }

        applySavedSection(
          mapApplicationToForm({ ...emptySections, identity: response.data }),
        );
        setLastSavedIdentity(normalizeIdentity(values));
      }
    }

    // Save Step 2: Business Location
    if (currentStep === 2) {
      const currentLocation = normalizeLocation(values);

      if (hasLocationChanged(lastSavedLocation, currentLocation)) {
        let payload: ReturnType<typeof buildLocationPayload>;

        try {
          payload = buildLocationPayload(values);
        } catch (error) {
          console.error("Failed to build business location payload:", error);

          Toast.show({
            type: "error",
            text1: "Unable to save changes",
            text2:
              "Something went wrong while preparing your business location.",
          });

          return false;
        }

        const response = await saveLocation(payload);

        if (!isCurrentSession() || !response.success) {
          return false;
        }

        applySavedSection(
          mapApplicationToForm({ ...emptySections, location: response.data }),
        );
        savedLocationSelection.current = mapApplicationToStore({
          location: response.data,
        });
        setLastSavedLocation(normalizeLocation(values));
      }
    }

    // Save Step 3: Operating Hours
    if (currentStep === 3) {
      const currentOperatingHours = normalizeOperatingHours(values);
      const payload = buildOperatingHoursPayload(values);

      // Save only when this section has never been saved before,
      // or when the current operating hours differ from the last
      // successfully saved version.
      if (
        shouldSaveOperatingHours(lastSavedOperatingHours, currentOperatingHours)
      ) {
        const response = await saveOperatingHours(payload);

        if (!isCurrentSession() || !response.success) {
          return false;
        }

        applySavedSection(
          mapApplicationToForm({
            ...emptySections,
            operating_hours: response.data,
          }),
        );
        setLastSavedOperatingHours(normalizeOperatingHours(values));
      }
    }

    // Save Step 4: Business Photos
    if (currentStep === 4) {
      const photoChanges = getPhotoChanges(
        lastSavedPhotos,
        values.businessPhotos,
      );

      if (!photoChanges.hasChanges) {
        return true;
      }

      const formData = buildPhotoUploadFormData(
        values.businessPhotos,
        photoChanges.deletedPhotoIds,
      );

      const response = await savePhotos(formData);

      if (!isCurrentSession() || !response.success) {
        return false;
      }

      const savedPhotos = mapApplicationPhotos(response.data);

      setLastSavedPhotos(savedPhotos);
      savedValues.current = {
        ...savedValues.current,
        businessPhotos: savedPhotos,
      };
      values.businessPhotos = savedPhotos;
    }

    // Save Step 5: Verification Documents
    if (currentStep === 5) {
      const documentChanges = getDocumentChanges(
        lastSavedDocuments,
        values.verificationDocuments,
      );

      if (!documentChanges.hasChanges) {
        return true;
      }

      const formData = buildDocumentUploadFormData(
        values.verificationDocuments,
        documentChanges.deletedDocumentIds,
      );

      const response = await saveDocuments(formData);

      if (!isCurrentSession() || !response.success) {
        return false;
      }

      const savedDocuments = mapApplicationDocuments(response.data);

      setLastSavedDocuments(savedDocuments);
      savedValues.current = {
        ...savedValues.current,
        verificationDocuments: savedDocuments,
      };
      values.verificationDocuments = savedDocuments;
    }

    for (const field of fields) {
      savedValues.current = {
        ...savedValues.current,
        [field]: structuredClone(values[field]),
      };
    }
    if (!isSameRevision()) {
      Toast.show({
        type: "info",
        text1: "New changes still need saving",
        text2: "Your saved section is up to date, but newer local edits have not been saved yet.",
      });
      return false;
    }
    for (const field of fields) {
      form.setValue(field, values[field], { shouldDirty: false });
    }
    if (currentStep === 2) {
      persistCurrentAddress(values);
      useMerchantRegistrationStore.setState(
        structuredClone(savedLocationSelection.current),
      );
    }
    return true;
  };

  function unsavedSectionsNow() {
    return getUnsavedSections({
      values: form.getValues(),
      lastSavedIdentity,
      lastSavedLocation,
      lastSavedOperatingHours,
      lastSavedPhotos,
      lastSavedDocuments,
    });
  }

  function prepareReview() {
    const sections = unsavedSectionsNow();
    if (sections.length > 0) {
      Toast.show({
        type: "info",
        text1: "Save your changes before reviewing",
        text2: sections.join(", "),
      });
      return false;
    }
    setReviewValues(structuredClone(savedValues.current));
    return true;
  }

  /** Shares one synchronous lock across validation, writes, and step transitions. */
  async function persistAndContinue(returnToReview = false) {
    if (savingRef.current || isSavingCurrentStep || !isCurrentSession()) {
      return;
    }
    savingRef.current = true;
    setIsPersisting(true);
    Keyboard.dismiss();

    try {
      if (currentStep === REVIEW_STEP) {
        if (!prepareReview() || !canResubmit) {
          return;
        }
        const result = await submit();
        if (!isCurrentSession() || !result.success || !result.data) {
          return;
        }
        allowRemoval.current = true;
        resetMerchantRegistrationStore();
        router.replace({
          pathname: "/(explorer)/merchant-registration/submission-success",
          params: {
            minBusinessDays: String(result.data.review_sla_min_business_days),
            maxBusinessDays: String(result.data.review_sla_max_business_days),
          },
        });
        return;
      }

      const success = await saveCurrentStep();
      if (!success || !isCurrentSession()) {
        return;
      }
      // Baseline state setters commit on the next render. Compare against the
      // synchronous successful snapshots before entering Review.
      const snapshotSections = getUnsavedSections({
        values: form.getValues(),
        lastSavedIdentity: normalizeIdentity(savedValues.current),
        lastSavedLocation: normalizeLocation(savedValues.current),
        lastSavedOperatingHours: normalizeOperatingHours(savedValues.current),
        lastSavedPhotos: savedValues.current.businessPhotos,
        lastSavedDocuments: savedValues.current.verificationDocuments,
      });
      if (returnToReview || currentStep === 5) {
        if (snapshotSections.length > 0) {
          Toast.show({
            type: "info",
            text1: "Save your changes before reviewing",
            text2: snapshotSections.join(", "),
          });
          return;
        }
        setReviewValues(structuredClone(savedValues.current));
        if (returnToReview) {
          goToReview();
          return;
        }
        setShowReviewCelebration(true);
      }
      completeCurrentStep(currentStep);
    } catch {
      if (isCurrentSession()) {
        Toast.show({
          type: "error",
          text1: "Unable to save changes",
          text2: "Your changes are still here. Please try again.",
        });
      }
    } finally {
      savingRef.current = false;
      setIsPersisting(false);
    }
  }

  const restoreSavedReview = useCallback(() => {
    form.reset(structuredClone(savedValues.current));
    resetMerchantRegistrationStore();
    useMerchantRegistrationStore.setState(
      structuredClone(savedLocationSelection.current),
    );
    setReviewValues(structuredClone(savedValues.current));
    goToReview();
  }, [form, resetMerchantRegistrationStore, goToReview, setReviewValues]);

  /** Footer and hardware Back share the same wizard intent. */
  const requestBack = useCallback(() => {
    if (savingRef.current || isSavingCurrentStep) {
      return;
    }
    if (editingStep !== null) {
      requestExit(restoreSavedReview);
    } else if (currentStep === REVIEW_STEP) {
      requestReviewExit();
    } else if (currentStep > 1) {
      handleBack();
    } else {
      requestExit(() => leaveRegistration(() => router.back()));
    }
  }, [
    isSavingCurrentStep,
    editingStep,
    currentStep,
    REVIEW_STEP,
    requestExit,
    requestReviewExit,
    handleBack,
    leaveRegistration,
    restoreSavedReview,
  ]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          requestBack();
          return true;
        },
      );
      return () => subscription.remove();
    }, [requestBack]),
  );

  if (isLoadingApplication) {
    return (
      <LoadingScreen
        title="Preparing your registration"
        description="Please wait while we load your registration details."
      />
    );
  }

  if (applicationError && !application) {
    return (
      <ErrorState
        title="Unable to load registration"
        description="Please check your connection and try again before editing your application."
        primaryActionTitle="Try Again"
        onPrimaryAction={refetchApplication}
        secondaryActionTitle="Go Back"
        onSecondaryAction={() => router.back()}
      />
    );
  }

  if (restoreError) {
    return (
      <ErrorState
        title="Unable to restore registration"
        description="We couldn't restore your saved registration. Please try again."
        primaryActionTitle="Try Again"
        onPrimaryAction={() => {
          setRestoreError(false);
          hasRestoredDraft.current = false;
          refetchApplication();
        }}
        secondaryActionTitle="Go Back"
        onSecondaryAction={() => router.back()}
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
              title={
                currentStep === REVIEW_STEP && isResubmission
                  ? "Review & Resubmit"
                  : REGISTRATION_STEPS[currentStep - 1].title
              }
              isResubmission={isResubmission}
            />
          }
          footer={
            <RegistrationFooter
              currentStep={currentStep}
              totalSteps={REVIEW_STEP}
              onNext={() => void persistAndContinue()}
              onBack={requestBack}
              isEditing={editingStep !== null}
              onSaveAndReview={() => void persistAndContinue(true)}
              isSubmitting={isSavingCurrentStep}
              isResubmission={isResubmission}
              canResubmit={canResubmit && !applicationError}
              hasChanges={hasUnsavedChanges}
            />
          }

          overlay={showReviewCelebration ? <ReviewCelebration /> : null}
        >
          {applicationError && application && (
            <ErrorState
              size="section"
              title="Unable to refresh registration"
              description="Showing the last saved application details. Try again to refresh review feedback."
              primaryActionTitle="Try Again"
              onPrimaryAction={() => {
                void refetchApplication();
              }}
            />
          )}

          <View
            pointerEvents={isSavingCurrentStep ? "none" : "auto"}
            accessibilityState={{ busy: isSavingCurrentStep }}
          >
            <RegistrationStepContent
              application={application}
              currentStep={currentStep}
              clusters={clusters}
              categories={categories}

              isLoadingClusters={isLoadingClusters}
              isLoadingCategories={isLoadingCategories}

              clustersError={clustersError}
              categoriesError={categoriesError}

              refetchClusters={refetchClusters}
              refetchCategories={refetchCategories}

              onEditSection={(step) => {
                if (!savingRef.current && !isSavingCurrentStep) {
                  handleEditSection(step);
                }
              }}
              reviewValues={reviewValues}
              isResubmission={isResubmission}
              feedback={feedback}
              registerErrorScrollTarget={registerErrorScrollTarget}
            />
          </View>
        </RegistrationLayout>
      </FormProvider>

      <ConfirmModal
        visible={showLeaveReviewModal}
        title="Leave application review?"
        message="Your saved application details will be kept. You can return and submit later."
        confirmText="Exit to Portal"
        cancelText="Stay Here"
        onConfirm={exitReviewToPortal}
        onCancel={() => {
          setShowLeaveReviewModal(false);
          pendingExitAction.current = null;
        }}
      />

      <ConfirmModal
        visible={showDiscardChangesModal}
        title="Discard changes?"
        destructive
        message={<DiscardChangesMessage sections={unsavedSections} />}
        confirmText="Discard"
        cancelText="Stay"
        onConfirm={handleDiscardChanges}
        onCancel={() => {
          setShowDiscardChangesModal(false);
          pendingExitAction.current = null;
        }}
      />
    </>
  );
}
