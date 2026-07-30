import { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import { useFormContext, useWatch } from "react-hook-form";
import { View } from "react-native";

import RHFFormInput from "@/shared/components/form/RHFFormInput";
import BusinessLocationSearch from "../BusinessLocationSearch";
import BusinessLocationMap from "../BusinessLocationMap";
import RegistrationSection from "../RegistrationSection";

/**
 * Displays the business location fields for the
 * merchant registration flow.
 *
 * Merchants can search for their business or tap the map
 * to select its exact location, then provide any additional
 * address details.
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
    address?: string,
  ) {
    console.log("SELECTED LOCATION:", {
      latitude: selectedLatitude,
      longitude: selectedLongitude,
      address,
    });
    setValue("latitude", selectedLatitude, {
      shouldValidate: true,
      shouldDirty: true,
    });

    setValue("longitude", selectedLongitude, {
      shouldValidate: true,
      shouldDirty: true,
    });

    if (address) {
      setValue("streetAddress", address, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }

  return (
    <>
      <RegistrationSection
        icon="map-marker-radius-outline"
        title="Pin Your Business Location"
        description="Search for your business or tap the map to mark its exact location."
        showBorder={false}
      >
        <View>
          <BusinessLocationSearch onPlaceSelect={handleLocationSelect} />

          <BusinessLocationMap
            latitude={latitude}
            longitude={longitude}
            onLocationSelect={handleLocationSelect}
          />
        </View>
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
