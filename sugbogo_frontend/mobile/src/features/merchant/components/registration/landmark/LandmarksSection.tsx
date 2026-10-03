import { router } from "expo-router";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";

import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";

import SelectedLandmarksSection from "./SelectedLandmarksSection";

/** Keeps the shared landmark selection surface bound to Registration state. */
export default function LandmarksSection() {
  const { setValue } = useFormContext<MerchantRegistrationForm>();
  const selectedLandmarks = useMerchantRegistrationStore(
    (state) => state.selectedLandmarks,
  );
  const setSelectedLandmarks = useMerchantRegistrationStore(
    (state) => state.setSelectedLandmarks,
  );
  const selectedLocation = useMerchantRegistrationStore(
    (state) => state.selectedLocation,
  );
  const nearbyLandmarksLoadFailed = useMerchantRegistrationStore(
    (state) => state.nearbyLandmarksLoadFailed,
  );

  useEffect(() => {
    setValue("landmarks", selectedLandmarks);
  }, [selectedLandmarks, setValue]);

  return (
    <SelectedLandmarksSection
      selectedLandmarks={selectedLandmarks}
      hasSelectedLocation={selectedLocation !== null}
      nearbyLandmarksLoadFailed={nearbyLandmarksLoadFailed}
      onRemove={(id) =>
        setSelectedLandmarks(
          selectedLandmarks.filter((landmark) => landmark.id !== id),
        )
      }
      onAddCustom={() =>
        router.push("/(explorer)/merchant-registration/landmarks-picker")
      }
    />
  );
}
