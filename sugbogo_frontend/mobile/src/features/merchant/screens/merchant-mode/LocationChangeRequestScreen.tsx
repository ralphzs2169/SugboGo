import { router, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
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

import LocationChangeComparison from "../../components/location-change/LocationChangeComparison";
import SelectedLandmarksSection from "../../components/registration/landmark/SelectedLandmarksSection";
import LocationPickerMap from "../../components/registration/location/LocationPickerMap";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import {
  useMerchantLocationChangeRequests,
  useSubmitMerchantLocationChange,
} from "../../hooks/location-change/useMerchantLocationChanges";
import { useLocationChangeDraftStore } from "../../stores/locationChangeDraftStore";
import type { LocationChangeLocation } from "../../types/locationChange.types";
import {
  buildLocationChangePayload,
  liveLocationProposal,
  locationProposalChanged,
} from "../../utils/locationChange.utils";

/** Builds and reviews a Location request without editing the live Business. */
export default function LocationChangeRequestScreen() {
  const insets = useSafeAreaInsets();
  const submittingRef = useRef(false);
  const [isReviewing, setIsReviewing] = useState(false);
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

  useEffect(() => {
    if (pendingRequest) {
      router.replace(
        `/(merchant)/business-update-requests/location/${pendingRequest.id}` as Href,
      );
    }
  }, [pendingRequest]);

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
    if (!location.address.trim()) errors.address = "Address is required.";
    if (!location.city.trim()) errors.city = "City is required.";
    if (!location.province.trim()) errors.province = "Province is required.";
    if (landmarks.length > 5) errors.landmarks = "Select up to 5 landmarks.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError("Review the highlighted location details.");
      return;
    }
    const payload = buildLocationChangePayload(location, landmarks);
    if (!locationProposalChanged(business, payload)) {
      setFormError("Choose a different location or landmark set.");
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
      submitRequest.isPending
    ) {
      return;
    }
    submittingRef.current = true;
    try {
      const result = await submitRequest.mutateAsync(
        buildLocationChangePayload(location, landmarks),
      );
      reset();
      Toast.show({ type: "success", text1: "Location request submitted" });
      router.replace(
        `/(merchant)/business-update-requests/location/${result.id}` as Href,
      );
    } catch (error) {
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

  function cancelEditing() {
    if (
      business &&
      location &&
      locationProposalChanged(
        business,
        buildLocationChangePayload(location, landmarks),
      )
    ) {
      setDiscardVisible(true);
      return;
    }
    reset();
    router.back();
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
        onSecondaryAction={() => router.back()}
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
        onPrimaryAction={() => router.back()}
      />
    );
  }
  if (pendingRequest || !location) {
    return (
      <LoadingScreen
        title="Loading Location"
        description="Preparing your request..."
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-5"
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {isReviewing ? (
          <>
            {/* Current and requested state */}
            <LocationChangeComparison
              title="Current Location"
              location={liveLocationProposal(business.location)}
              landmarks={business.location.landmarks}
            />
            <View className="mt-4">
              <LocationChangeComparison
                title="Requested Location"
                location={location}
                landmarks={landmarks}
              />
            </View>
            <AppText className="mt-4 text-sm leading-5 text-text-secondary">
              Your current business location and landmarks will remain visible
              until an Admin approves this request.
            </AppText>
          </>
        ) : (
          <>
            {/* Registration-style map selection */}
            <AppText weight="bold" className="text-lg text-text-primary">
              Pin Your Business Location
            </AppText>
            <AppText className="mt-1 text-sm text-text-secondary">
              Search for a place or tap the map to select the requested
              location.
            </AppText>
            <View className="mt-4 overflow-hidden rounded-2xl">
              <LocationPickerMap
                latitude={location.latitude}
                longitude={location.longitude}
                onOpenPicker={() =>
                  router.push("/(merchant)/location-change/picker" as Href)
                }
              />
            </View>

            {/* Flat live-address fields */}
            <View className="mt-6">
              <AppText
                weight="bold"
                className="mb-3 text-base text-text-primary"
              >
                Address Details
              </AppText>
              <FormInput
                label="Address"
                required
                value={location.address}
                onChangeText={(value) => updateAddress("address", value)}
                error={fieldErrors.address}
                maxLength={255}
                placeholder="Flat business address"
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
            </View>

            {/* Shared landmark selection */}
            <View className="-mx-5 mt-2">
              <SelectedLandmarksSection
                selectedLandmarks={landmarks}
                hasSelectedLocation
                nearbyLandmarksLoadFailed={nearbyLoadFailed}
                onRemove={(id) =>
                  setLandmarks(
                    landmarks.filter((landmark) => landmark.id !== id),
                  )
                }
                onAddCustom={() =>
                  router.push(
                    "/(merchant)/location-change/landmarks-picker" as Href,
                  )
                }
              />
            </View>
            {fieldErrors.landmarks ? (
              <AppText className="mt-2 text-xs text-text-error">
                {fieldErrors.landmarks}
              </AppText>
            ) : null}
          </>
        )}
        {formError ? (
          <AppText className="mt-4 text-sm text-text-error">
            {formError}
          </AppText>
        ) : null}
      </ScrollView>

      {/* Review and submit actions */}
      <View
        className="flex-row gap-3 border-t border-border-primary bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button
          title={isReviewing ? "Edit" : "Cancel"}
          variant="outline"
          className="flex-1"
          onPress={() =>
            isReviewing ? setIsReviewing(false) : cancelEditing()
          }
          disabled={submitRequest.isPending}
        />
        <Button
          title={isReviewing ? "Submit Request" : "Review Request"}
          className="flex-1"
          onPress={() => (isReviewing ? void submitValues() : reviewRequest())}
          loading={submitRequest.isPending}
        />
      </View>
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
