import { router } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";

import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import useNearbyLandmarks from "@/features/merchant/hooks/location-selection/useNearbyLandmarks";
import { isDuplicateLandmarkName } from "@/features/merchant/validation/duplicateLandmark";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
} from "@/shared/api/authSessionGeneration.service";

import SelectedLandmarksSection from "./SelectedLandmarksSection";

/** Keeps the shared landmark selection surface bound to Registration state. */
export default function LandmarksSection() {
  const {
    setValue,
    formState: { disabled },
  } = useFormContext<MerchantRegistrationForm>();
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
  const { searchNearbyLandmarks } = useNearbyLandmarks();
  const [isRetrying, setIsRetrying] = useState(false);
  const retryInFlight = useRef(false);
  const retryGeneration = useRef(0);
  const disabledRef = useRef(disabled);
  const mountedRef = useRef(false);

  useLayoutEffect(() => {
    disabledRef.current = disabled;
    if (disabled) {
      retryGeneration.current += 1;
    }
  }, [disabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function retryNearbyLandmarks() {
    if (disabledRef.current || retryInFlight.current || !selectedLocation) {
      return;
    }

    const ownerId = useAuthStore.getState().user?.id;
    const generation = getAuthSessionGeneration();
    const operation = retryGeneration.current;
    if (ownerId === undefined || !useAuthStore.getState().isAuthenticated) {
      return;
    }

    retryInFlight.current = true;
    setIsRetrying(true);
    try {
      const result = await searchNearbyLandmarks(
        selectedLocation.latitude,
        selectedLocation.longitude,
      );
      const current = useMerchantRegistrationStore.getState();
      const auth = useAuthStore.getState();
      if (
        !mountedRef.current ||
        disabledRef.current ||
        operation !== retryGeneration.current ||
        !auth.isAuthenticated ||
        auth.user?.id !== ownerId ||
        !isAuthSessionCurrent(generation) ||
        current.selectedLocation !== selectedLocation ||
        !result.success
      ) {
        return;
      }

      // Preserve current selections, including custom additions during Retry.
      const landmarks = [...current.selectedLandmarks];
      for (const landmark of result.landmarks) {
        if (landmarks.length >= 5) break;
        if (
          landmarks.some((selected) => selected.id === landmark.id) ||
          isDuplicateLandmarkName(landmark.name, landmarks)
        ) {
          continue;
        }
        landmarks.push(landmark);
      }
      current.setSelectedLandmarks(landmarks);
      current.setNearbyLandmarksLoadFailed(false);
    } finally {
      retryInFlight.current = false;
      if (mountedRef.current) {
        setIsRetrying(false);
      }
    }
  }

  useEffect(() => {
    setValue("landmarks", selectedLandmarks);
  }, [selectedLandmarks, setValue]);

  return (
    <SelectedLandmarksSection
      selectedLandmarks={selectedLandmarks}
      hasSelectedLocation={selectedLocation !== null}
      nearbyLandmarksLoadFailed={nearbyLandmarksLoadFailed}
      onRetryNearby={disabled ? undefined : () => void retryNearbyLandmarks()}
      isRetryingNearby={isRetrying}
      onRemove={(id) => {
        if (disabled) return;
        setSelectedLandmarks(
          selectedLandmarks.filter((landmark) => landmark.id !== id),
        );
      }}
      onAddCustom={() => {
        if (!disabled) {
          router.push("/(explorer)/merchant-registration/landmarks-picker");
        }
      }}
    />
  );
}
