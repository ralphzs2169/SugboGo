import { router, useFocusEffect, useNavigation, type Href } from "expo-router";
import { HeaderBackButton } from "expo-router/build/react-navigation/elements/Header/HeaderBackButton";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import FormInput from "@/shared/components/form/FormInput";
import LoadingScreen from "@/shared/components/LoadingScreen";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import LocationChangeReviewSections from "../../components/location-change/LocationChangeReviewSections";
import SelectedLandmarksSection from "../../components/registration/landmark/SelectedLandmarksSection";
import LocationPickerMap from "../../components/registration/location/LocationPickerMap";
import RegistrationSection from "../../components/registration/RegistrationSection";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import {
  useMerchantLocationChangeRequests,
  useSubmitMerchantLocationChange,
} from "../../hooks/location-change/useMerchantLocationChanges";
import { useLocationChangeDraftStore } from "../../stores/locationChangeDraftStore";
import { useLocationChangeReviewStore } from "../../stores/locationChangeReviewStore";
import type { LocationChangeLocation } from "../../types/locationChange.types";
import {
  buildLocationChangePayload,
  liveLocationProposal,
  locationProposalChanged,
} from "../../utils/locationChange.utils";

/**
 * Allows merchants to prepare and submit a business location change request.
 *
 * Initializes the form from the live business listing, enables review only
 * when location or landmark changes exist, and presents the proposed and
 * current live locations before submission. The live listing is never
 * modified directly.
 */
export default function LocationChangeRequestScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const submittingRef = useRef(false);
  const submittedRef = useRef(false);
  const hasChangesRef = useRef(false);

  const [isReviewing, setIsReviewing] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [discardVisible, setDiscardVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  const {
    business,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useMerchantBusinessProfile();

  const {
    pendingRequest,
    hasData: hasRequestsData,
    isLoading: isRequestsLoading,
    error: requestsError,
    refetch: refetchRequests,
  } = useMerchantLocationChangeRequests();

  const submitRequest = useSubmitMerchantLocationChange();

  const location = useLocationChangeDraftStore((state) => state.location);
  const landmarks = useLocationChangeDraftStore((state) => state.landmarks);

  const nearbyLoadFailed = useLocationChangeDraftStore(
    (state) => state.nearbyLandmarksLoadFailed,
  );

  const initialize = useLocationChangeDraftStore((state) => state.initialize);
  const setLocation = useLocationChangeDraftStore((state) => state.setLocation);
  const setLandmarks = useLocationChangeDraftStore(
    (state) => state.setLandmarks,
  );
  const reset = useLocationChangeDraftStore((state) => state.reset);

  const setReviewPreview = useLocationChangeReviewStore(
    (state) => state.setPreview,
  );

  const hasChanges = Boolean(
    business &&
    location &&
    locationProposalChanged(
      business,
      buildLocationChangePayload(location, landmarks),
    ),
  );

  useLayoutEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);

  const requestExit = useCallback(() => {
    if (submittingRef.current || submittedRef.current) {
      return;
    }

    if (hasChangesRef.current) {
      setDiscardVisible(true);
      return;
    }

    reset();
    router.back();
  }, [reset]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <HeaderBackButton onPress={requestExit} />,
    });
  }, [navigation, requestExit]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          requestExit();
          return true;
        },
      );

      return () => subscription.remove();
    }, [requestExit]),
  );

  useEffect(
    () => () => {
      if (submittedRef.current) {
        reset();
      }
    },
    [reset],
  );

  useQueryErrorNotification({
    error: profileError || requestsError,
    toastId: "location-change-form-error",
    title: "Unable to load location request",
    fallbackMessage: "Please try again.",
  });

  useEffect(() => {
    if (
      business &&
      business.status === "active" &&
      hasRequestsData &&
      !pendingRequest
    ) {
      initialize(business);
    }
  }, [business, hasRequestsData, initialize, pendingRequest]);

  function updateAddress(field: keyof LocationChangeLocation, value: string) {
    if (!location) {
      return;
    }

    setLocation({ ...location, [field]: value });
    setFieldErrors((errors) => ({ ...errors, [field]: "" }));
    setFormError(undefined);
  }

  function reviewRequest() {
    if (!business || !location || submitRequest.isPending) {
      return;
    }

    const errors: Record<string, string> = {};

    if (!location.address.trim()) {
      errors.address = "Address is required.";
    }

    if (!location.city.trim()) {
      errors.city = "City is required.";
    }

    if (!location.province.trim()) {
      errors.province = "Province is required.";
    }

    if (landmarks.length > 5) {
      errors.landmarks = "Select up to 5 landmarks.";
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setFormError("Review the highlighted location details.");
      return;
    }

    const payload = buildLocationChangePayload(location, landmarks);

    if (!locationProposalChanged(business, payload)) {
      setFormError("Change the location or landmarks before continuing.");
      return;
    }

    setFormError(undefined);
    setIsReviewing(true);
  }

  async function submitValues() {
    if (
      !business ||
      !location ||
      submittingRef.current ||
      submitRequest.isPending ||
      isSubmittingRequest
    ) {
      return;
    }

    submittingRef.current = true;
    setIsSubmittingRequest(true);

    try {
      const result = await submitRequest.mutateAsync(
        buildLocationChangePayload(location, landmarks),
      );

      Toast.show({
        type: "success",
        text1: "Location request submitted",
      });

      submittedRef.current = true;
      router.replace(
        `/(merchant)/business-update-requests/location/${result.id}` as Href,
      );
    } catch (error) {
      setIsSubmittingRequest(false);
      const response = error as ApiError;

      if (response.message?.includes("already pending")) {
        void refetchRequests();
      }

      if (!handleSystemError(response)) {
        const errors = response.errors ?? {};
        const locationErrors = errors.proposed_location;
        const mappedErrors: Record<string, string> = {};

        for (const field of ["address", "city", "province", "postal_code"]) {
          const message =
            errors[field]?.[0] ?? errors[`proposed_location.${field}`]?.[0];

          if (message) {
            mappedErrors[field] = message;
          }
        }

        const landmarkError = errors.proposed_landmarks?.[0];

        if (landmarkError) {
          mappedErrors.landmarks = landmarkError;
        }

        setFieldErrors(mappedErrors);

        if (Object.keys(mappedErrors).length > 0) {
          setIsReviewing(false);
        }

        setFormError(
          locationErrors?.[0] ||
            response.message ||
            "Unable to submit the request.",
        );
      }
    } finally {
      submittingRef.current = false;
    }
  }

  function viewLocation(
    title: string,
    snapshot: LocationChangeLocation,
    selectedLandmarks: Parameters<typeof setReviewPreview>[2],
  ) {
    setReviewPreview(title, snapshot, selectedLandmarks);

    router.push("/(merchant)/location-change/review-landmarks" as Href);
  }

  if (!business || profileError || requestsError) {
    if (
      (isProfileLoading && !profileError) ||
      (isRequestsLoading && !requestsError)
    ) {
      return (
        <LoadingScreen
          title="Loading Location"
          description="Preparing your request..."
        />
      );
    }

    return (
      <ErrorState
        title="Unable to load location request"
        description="Please try again."
        primaryActionTitle="Retry"
        onPrimaryAction={() =>
          void Promise.all([refetchProfile(), refetchRequests()])
        }
        secondaryActionTitle="Go Back"
        onSecondaryAction={requestExit}
      />
    );
  }

  if (isRequestsLoading || !hasRequestsData) {
    return (
      <LoadingScreen
        title="Loading Location"
        description="Preparing your request..."
      />
    );
  }

  if (business.status !== "active") {
    return (
      <ErrorState
        title="Location changes unavailable"
        description="Your business must be active to request a location change."
        primaryActionTitle="Go Back"
        onPrimaryAction={requestExit}
      />
    );
  }

  if (pendingRequest && !isSubmittingRequest) {
    return (
      <ErrorState
        title="Pending Admin review"
        description="A location change request is already pending. Your current business location remains visible until approval."
        primaryActionTitle="View Request"
        onPrimaryAction={() => {
          reset();
          router.replace(
            `/(merchant)/business-update-requests/location/${pendingRequest.id}` as Href,
          );
        }}
      />
    );
  }

  if (!location) {
    return (
      <LoadingScreen
        title="Loading Location"
        description="Preparing your request..."
      />
    );
  }

  const currentLiveLocation = liveLocationProposal(business.location);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="pt-2"
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isReviewing ? (
          <LocationChangeReviewSections
            currentLocation={currentLiveLocation}
            proposedLocation={location}
            currentLandmarks={business.location.landmarks}
            proposedLandmarks={landmarks}
            onViewCurrent={() =>
              viewLocation(
                "Current business pin",
                currentLiveLocation,
                business.location.landmarks,
              )
            }
            onViewProposed={() =>
              viewLocation(
                "Requested location and landmarks",
                location,
                landmarks,
              )
            }
          />
        ) : (
          <>
            {/* Location selection */}
            <RegistrationSection
              title="Business location"
              description="Select a new location or keep your pin and update nearby landmarks."
              icon="map-marker-outline"
            >
              <View className="overflow-hidden rounded-2xl">
                <LocationPickerMap
                  latitude={location.latitude}
                  longitude={location.longitude}
                  onOpenPicker={() =>
                    router.push("/(merchant)/location-change/picker" as Href)
                  }
                />
              </View>
            </RegistrationSection>

            {/* Address details */}
            <RegistrationSection
              title="Address details"
              icon="map-marker-radius-outline"
            >
              <FormInput
                label="Address"
                required
                value={location.address}
                onChangeText={(value) => updateAddress("address", value)}
                error={fieldErrors.address}
                maxLength={255}
                placeholder="Street address or building name"
              />

              <FormInput
                label="City / Municipality"
                required
                value={location.city}
                onChangeText={(value) => updateAddress("city", value)}
                error={fieldErrors.city}
                maxLength={100}
              />

              <FormInput
                label="Province"
                required
                value={location.province}
                onChangeText={(value) => updateAddress("province", value)}
                error={fieldErrors.province}
                maxLength={100}
              />

              <FormInput
                label="Postal code (Optional)"
                value={location.postal_code ?? ""}
                onChangeText={(value) => updateAddress("postal_code", value)}
                error={fieldErrors.postal_code}
                maxLength={10}
                keyboardType="numbers-and-punctuation"
              />
            </RegistrationSection>

            {/* Landmark selection */}
            <SelectedLandmarksSection
              selectedLandmarks={landmarks}
              hasSelectedLocation
              nearbyLandmarksLoadFailed={nearbyLoadFailed}
              onRemove={(id) =>
                setLandmarks(landmarks.filter((landmark) => landmark.id !== id))
              }
              onAddCustom={() =>
                router.push(
                  "/(merchant)/location-change/landmarks-picker" as Href,
                )
              }
            />
            {fieldErrors.landmarks ? (
              <AppText className="mt-2 px-6 text-xs text-text-error">
                {fieldErrors.landmarks}
              </AppText>
            ) : null}
          </>
        )}

        {/* Form feedback */}
        {formError ? (
          <AppText className="mt-4 px-6 text-sm text-text-error">
            {formError}
          </AppText>
        ) : null}
      </ScrollView>

      {/* Review and submission actions */}
      <View
        className="flex-row gap-3 border-t border-border-primary bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button
          title={isReviewing ? "Edit" : "Cancel"}
          variant="outline"
          className="flex-1"
          onPress={() => {
            if (isReviewing) {
              setIsReviewing(false);
              return;
            }

            requestExit();
          }}
          disabled={submitRequest.isPending || isSubmittingRequest}
          rounded="full"
        />

        <Button
          title={isReviewing ? "Submit Request" : "Review Changes"}
          className="flex-1"
          onPress={() => (isReviewing ? void submitValues() : reviewRequest())}
          disabled={
            submitRequest.isPending ||
            isSubmittingRequest ||
            (!isReviewing && !hasChanges)
          }
          loading={submitRequest.isPending || isSubmittingRequest}
          rounded="full"
        />
      </View>

      {/* Discard confirmation */}
      <ConfirmModal
        visible={discardVisible}
        title="Discard location request?"
        message="Your current live location and landmarks will remain unchanged."
        confirmText="Discard"
        destructive
        onCancel={() => setDiscardVisible(false)}
        onConfirm={() => {
          reset();
          setDiscardVisible(false);
          router.back();
        }}
      />
    </KeyboardAvoidingView>
  );
}
