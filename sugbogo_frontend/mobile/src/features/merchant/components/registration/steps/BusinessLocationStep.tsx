import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { router } from "expo-router";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import RHFFormInput from "@/shared/components/form/RHFFormInput";
import BusinessLocationMap from "../location/LocationMap";
import RegistrationSection from "../RegistrationSection";
import LandmarksSection from "../landmark/LandmarksSection";
import { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
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
 * business location.
 */
export default function BusinessLocationStep() {
  const { setValue } = useFormContext<MerchantRegistrationForm>();

  const selectedLocation = useMerchantRegistrationStore(
    (state) => state.selectedLocation,
  );

  const selectedLandmarks = useMerchantRegistrationStore(
    (state) => state.selectedLandmarks,
  );

  const hasSelectedLocation = selectedLocation !== null;

  useEffect(() => {
    if (!selectedLocation) {
      return;
    }

    setValue("latitude", selectedLocation.latitude);
    setValue("longitude", selectedLocation.longitude);
    setValue("province", selectedLocation.province);
    setValue("city", selectedLocation.city);
    setValue("barangay", selectedLocation.barangay);
    setValue("streetAddress", selectedLocation.streetAddress);
  }, [selectedLocation, setValue]);

  useEffect(() => {
    setValue("landmarks", selectedLandmarks);
  }, [selectedLandmarks, setValue]);

  return (
    <>
      <RegistrationSection
        icon="map-marker-radius-outline"
        title="Pin Your Business Location"
        description="Place the pin as close as possible to your actual business location. You can edit the address details below if needed."
        showBorder={false}
      >
        <BusinessLocationMap
          latitude={selectedLocation?.latitude ?? null}
          longitude={selectedLocation?.longitude ?? null}
          onOpenPicker={() =>
            router.push("/(explorer)/merchant-registration/location-picker")
          }
        />
      </RegistrationSection>

      <RegistrationSection
        icon="home-map-marker"
        title="Address Details"
        description="Address details are automatically retrieved after you pin your business location. Review and update any missing information."
      >
        <RHFFormInput
          name="province"
          label="Province"
          required
          editable={false}
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
          placeholder={
            hasSelectedLocation ? "Enter barangay" : "Select a location first"
          }
        />

        <RHFFormInput
          name="streetAddress"
          label="Street Address"
          required
          editable={hasSelectedLocation}
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
