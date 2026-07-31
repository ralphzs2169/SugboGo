import { useLocalSearchParams, router } from "expo-router";

import BusinessLocationPickerScreen from "@/features/merchant/screens/BusinessLocationPickerScreen";

/**
 * Route wrapper for the full-screen business location picker.
 *
 * Receives the current coordinates through route params and
 * returns the confirmed location to the merchant registration form.
 */
export default function BusinessLocationPickerPage() {
  const { latitude, longitude } = useLocalSearchParams<{
    latitude?: string;
    longitude?: string;
  }>();

  const initialLatitude = latitude ? Number(latitude) : null;
  const initialLongitude = longitude ? Number(longitude) : null;

  function handleConfirm(
    selectedLatitude: number,
    selectedLongitude: number,
    address: string,
  ) {
    // TODO: Return the selected location to the registration form.
    console.log("CONFIRMED LOCATION:", {
      latitude: selectedLatitude,
      longitude: selectedLongitude,
      address,
    });

    router.back();
  }

  function handleClose() {
    router.back();
  }

  return (
    <BusinessLocationPickerScreen
      initialLatitude={initialLatitude}
      initialLongitude={initialLongitude}
      onConfirm={handleConfirm}
      onClose={handleClose}
    />
  );
}
