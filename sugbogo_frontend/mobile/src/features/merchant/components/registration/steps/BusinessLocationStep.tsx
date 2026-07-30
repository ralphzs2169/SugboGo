import RegistrationSection from "../RegistrationSection";
import RHFFormInput from "@/shared/components/form/RHFFormInput";
import { useFormContext, useWatch } from "react-hook-form";

import BusinessLocationMap from "../BusinessLocationMap";

import { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
/**
 * Displays the business location fields for the
 * merchant registration flow.
 *
 * Merchants first pin their business on the map,
 * then verify the detected address and provide any
 * additional location details.
 */
export default function BusinessLocationStep() {
  const { setValue } = useFormContext<MerchantRegistrationForm>();

  const latitude = useWatch({
    name: "latitude",
  });

  const longitude = useWatch({
    name: "longitude",
  });

  function handleLocationSelect(
    selectedLatitude: number,
    selectedLongitude: number,
  ) {
    setValue("latitude", selectedLatitude, {
      shouldValidate: true,
      shouldDirty: true,
    });

    setValue("longitude", selectedLongitude, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }
  return (
    <>
      <RegistrationSection
        icon="map-marker-radius-outline"
        title="Pin Your Business Location"
        description="Tap the map to mark where your business is located. We'll automatically detect your address."
      >
        <BusinessLocationMap
          latitude={latitude}
          longitude={longitude}
          onLocationSelect={handleLocationSelect}
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
