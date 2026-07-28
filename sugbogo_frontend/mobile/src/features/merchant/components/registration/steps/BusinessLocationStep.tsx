import RegistrationSection from "../RegistrationSection";
import MapPlaceholder from "../MapPlaceholder";

import RHFFormInput from "@/shared/components/form/RHFFormInput";

/**
 * Displays the business location fields for the
 * merchant registration flow.
 *
 * Merchants first pin their business on the map,
 * then verify the detected address and provide any
 * additional location details.
 */
export default function BusinessLocationStep() {
  return (
    <>
      <RegistrationSection
        icon="map-marker-radius-outline"
        title="Pin Your Business Location"
        description="Tap the map to mark where your business is located. We'll automatically detect your address."
      >
        <MapPlaceholder />
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
