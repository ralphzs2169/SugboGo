import { useCallback, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { router } from "expo-router";
import { View, Text } from "react-native";

import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import RHFFormInput from "@/shared/components/form/RHFFormInput";
import LocationPickerMap from "../location/LocationPickerMap";
import RegistrationSection from "../RegistrationSection";
import LandmarksSection from "../landmark/LandmarksSection";
import { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import AddressLoadFailedState from "../location/AddressFailedLoadState";

/**
 * Displays the business location section of the
 * merchant registration flow.
 *
 * The selected location is shown as a map preview.
 * Tapping the preview opens the full-screen location
 * picker, where merchants can search for a place or
 * select a location directly on the map.
 *
 * Address fields are populated from the confirmed
 * business location and can be reviewed or edited
 * when applicable.
 *
 * Location and address validation errors are shown
 * only after the user attempts to continue.
 */
export default function BusinessLocationStep() {
  const {
    setValue,
    formState: { errors },
    clearErrors,
  } = useFormContext<MerchantRegistrationForm>();

  const selectedLocation = useMerchantRegistrationStore(
    (state) => state.selectedLocation,
  );

  const selectedLandmarks = useMerchantRegistrationStore(
    (state) => state.selectedLandmarks,
  );

  const addressLoadFailed = useMerchantRegistrationStore(
    (state) => state.addressLoadFailed,
  );

  const hasSelectedLocation = selectedLocation !== null;
  const locationError = errors.latitude?.message ?? errors.longitude?.message;

  /**
   * Updates all form fields associated with the selected
   * business location.
   */
  const updateFormLocation = useCallback(() => {
    if (!selectedLocation) {
      return;
    }

    setValue("latitude", selectedLocation.latitude, { shouldValidate: false });
    setValue("longitude", selectedLocation.longitude, {
      shouldValidate: false,
    });
    setValue("province", selectedLocation.province, { shouldValidate: false });
    setValue("city", selectedLocation.city, { shouldValidate: false });
    setValue("barangay", selectedLocation.barangay, { shouldValidate: false });
    setValue("streetAddress", selectedLocation.streetAddress, {
      shouldValidate: false,
    });

    // A new location starts a fresh validation state.
    clearErrors([
      "latitude",
      "longitude",
      "province",
      "city",
      "barangay",
      "streetAddress",
    ]);
  }, [selectedLocation, setValue, clearErrors]);

  useEffect(() => {
    updateFormLocation();
  }, [updateFormLocation]);

  useEffect(() => {
    setValue("landmarks", selectedLandmarks, {
      shouldValidate: false,
    });
  }, [selectedLandmarks, setValue]);

  /**
   * Opens the full-screen location picker and clears
   * any existing location error.
   */
  const handleOpenLocationPicker = () => {
    clearErrors(["latitude", "longitude"]);

    router.push("/(explorer)/merchant-registration/location-picker");
  };

  return (
    <>
      {/* Business Location */}
      <RegistrationSection
        icon="map-marker-radius-outline"
        title="Pin Your Business Location"
        description="Place the pin as close as possible to your actual business location. You can edit the address details below if needed."
        showBorder={false}
      >
        <View
          className={`overflow-hidden rounded-2xl border ${
            locationError ? "border-text-error" : "border-transparent"
          }`}
        >
          <LocationPickerMap
            latitude={selectedLocation?.latitude ?? null}
            longitude={selectedLocation?.longitude ?? null}
            onOpenPicker={handleOpenLocationPicker}
          />
        </View>

        {locationError && (
          <Text className="mt-1 text-xs font-medium text-text-error">
            {locationError}
          </Text>
        )}
      </RegistrationSection>

      {/* Address Details */}
      <RegistrationSection
        icon="home-map-marker"
        title="Address Details"
        description="Address details are automatically retrieved after you pin your business location. Review and update any missing information."
      >
        {addressLoadFailed && <AddressLoadFailedState />}

        <RHFFormInput
          name="province"
          label="Province"
          required
          editable={false}
          showError={hasSelectedLocation}
          placeholder={
            hasSelectedLocation
              ? "Detected automatically"
              : "Select a location first"
          }
        />

        <RHFFormInput
          name="city"
          label="City / Municipality"
          required
          editable={false}
          showError={hasSelectedLocation}
          placeholder={
            hasSelectedLocation
              ? "Detected automatically"
              : "Select a location first"
          }
        />

        <RHFFormInput
          name="barangay"
          label="Barangay"
          required
          editable={hasSelectedLocation}
          showError={hasSelectedLocation}
          placeholder={
            hasSelectedLocation ? "Enter barangay" : "Select a location first"
          }
        />

        <RHFFormInput
          name="streetAddress"
          label="Street Address"
          required
          editable={hasSelectedLocation}
          showError={hasSelectedLocation}
          placeholder={
            hasSelectedLocation
              ? "e.g. Gov. Cuenco Avenue"
              : "Select a location first"
          }
        />

        <RHFFormInput
          name="unit"
          label="Unit / Building (Optional)"
          editable={hasSelectedLocation}
          placeholder={
            hasSelectedLocation
              ? "e.g. Unit 201, 2nd Floor"
              : "Select a location first"
          }
        />
      </RegistrationSection>

      <LandmarksSection />
    </>
  );
}
