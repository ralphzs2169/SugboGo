import { useWatch } from "react-hook-form";
import { router } from "expo-router";

import RHFFormInput from "@/shared/components/form/RHFFormInput";
import BusinessLocationMap from "../BusinessLocationMap";
import RegistrationSection from "../RegistrationSection";

/**
 * Displays the business location section of the
 * merchant registration flow.
 *
 * The selected location is shown as a map preview.
 * Tapping the preview opens the full-screen location
 * picker, where merchants can search for a place or
 * select a location directly on the map.
 *
 * Address fields are displayed below the map for
 * reviewing and completing the detected location details.
 */
export default function BusinessLocationStep() {
  // Watch the selected business coordinates so the map preview
  // stays synchronized with the registration form state.
  const latitude = useWatch({
    name: "latitude",
  });

  const longitude = useWatch({
    name: "longitude",
  });

  return (
    <>
      <RegistrationSection
        icon="map-marker-radius-outline"
        title="Pin Your Business Location"
        description="Search for your business or open the map to select its exact location."
        showBorder={false}
      >
        <BusinessLocationMap
          latitude={latitude}
          longitude={longitude}
          onOpenPicker={() =>
            router.push({
              pathname: "/(explorer)/merchant-registration/location-picker",
              params: {
                latitude: latitude?.toString() ?? "",
                longitude: longitude?.toString() ?? "",
              },
            })
          }
        />
      </RegistrationSection>

      <RegistrationSection
        icon="home-map-marker"
        title="Address Details"
        description="Review the detected address and complete any missing information."
      >
        <RHFFormInput
          name="province"
          label="Province"
          editable={false}
          placeholder="Detected automatically"
        />

        <RHFFormInput
          name="city"
          label="City / Municipality"
          editable={false}
          placeholder="Detected automatically"
        />

        <RHFFormInput
          name="barangay"
          label="Barangay"
          editable={false}
          placeholder="Detected automatically"
        />

        <RHFFormInput
          name="streetAddress"
          label="Street Address"
          required
          placeholder="e.g. Gov. Cuenco Avenue"
        />

        <RHFFormInput
          name="unit"
          label="Unit / Building (Optional)"
          placeholder="e.g. Unit 201, 2nd Floor"
        />

        <RHFFormInput
          name="landmark"
          label="Nearest Landmark (Optional)"
          placeholder="e.g. Across Cebu IT Park"
        />
      </RegistrationSection>
    </>
  );
}
