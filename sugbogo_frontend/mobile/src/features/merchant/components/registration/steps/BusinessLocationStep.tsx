import { router } from "expo-router";
import { useCallback, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Text, View } from "react-native";

import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import RHFFormInput from "@/shared/components/form/RHFFormInput";
import LandmarksSection from "../landmark/LandmarksSection";
import AddressLoadFailedState from "../location/AddressFailedLoadState";
import LocationPickerMap from "../location/LocationPickerMap";
import RegistrationSection from "../RegistrationSection";

/**
 * Displays the business location step of the merchant
 * registration flow.
 *
 * The confirmed business location is displayed as a
 * map preview. Merchants can reopen the full-screen
 * location picker at any time to select a different
 * location.
 *
 * Address fields are initially populated from the
 * confirmed location, but subsequent user edits are
 * restored from the persisted address stored in the
 * registration state. This preserves manual address
 * changes when navigating between registration steps
 * or revisiting the location step.
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

  const selectedAddress = useMerchantRegistrationStore(
    (state) => state.selectedAddress,
  );

  const selectedLandmarks = useMerchantRegistrationStore(
    (state) => state.selectedLandmarks,
  );

  const addressLoadFailed = useMerchantRegistrationStore(
    (state) => state.addressLoadFailed,
  );

  const addressLoadFailures = useMerchantRegistrationStore(
    (state) => state.addressLoadFailures,
  );

  const hasSelectedLocation = selectedLocation !== null;
  const locationError = errors.latitude?.message ?? errors.longitude?.message;

  /**
   * Synchronizes the registration form with the currently
   * selected business location.
   *
   * Geographic coordinates always come from the confirmed
   * map location, while editable address fields are
   * restored from the persisted registration state so
   * manual edits are preserved when returning to this
   * step.
   */
  const updateFormLocation = useCallback(() => {
    if (!selectedLocation) {
      return;
    }

    setValue("latitude", selectedLocation.latitude, { shouldValidate: false });
    setValue("longitude", selectedLocation.longitude, {
      shouldValidate: false,
    });

    // Restore the latest editable address instead of the
    // original reverse-geocoded address from the location.
    if (selectedAddress) {
      setValue("province", selectedAddress.province, {
        shouldValidate: false,
      });

      setValue("city", selectedAddress.city, {
        shouldValidate: false,
      });

      setValue("barangay", selectedAddress.barangay, {
        shouldValidate: false,
      });

      setValue("streetAddress", selectedAddress.streetAddress, {
        shouldValidate: false,
      });

      setValue("unit", selectedAddress.unit, {
        shouldValidate: false,
      });
    }

    // A new location starts a fresh validation state.
    clearErrors([
      "latitude",
      "longitude",
      "province",
      "city",
      "barangay",
      "streetAddress",
      "unit",
    ]);
  }, [selectedLocation, selectedAddress, setValue, clearErrors]);

  // Restore the saved location and address whenever this
  // step is mounted or the selected location changes.
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
          editable={hasSelectedLocation}
          showError={hasSelectedLocation}
          placeholder={
            hasSelectedLocation
              ? "Detected automatically"
              : "Select a location first"
          }
          helperText={
            addressLoadFailures.province
              ? "Unable to detect automatically. Please enter it manually."
              : undefined
          }
        />

        <RHFFormInput
          name="city"
          label="City / Municipality"
          required
          editable={hasSelectedLocation}
          showError={hasSelectedLocation}
          placeholder={
            hasSelectedLocation
              ? "Detected automatically"
              : "Select a location first"
          }
          helperText={
            addressLoadFailures.city
              ? "Unable to detect automatically. Please enter it manually."
              : undefined
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
          helperText={
            addressLoadFailures.barangay
              ? "Unable to detect automatically. Please enter it manually."
              : undefined
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
          helperText={
            addressLoadFailures.streetAddress
              ? "Unable to detect automatically. Please enter it manually."
              : undefined
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
