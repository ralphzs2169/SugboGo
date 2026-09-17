import { useCallback, useRef, useState } from "react";
import Toast from "react-native-toast-message";

import type { UserLocationStatus } from "@/shared/hooks/useUserLocation";
import { getRetryAfterMessage } from "@/shared/utils/retryAfterMessage";

import { reverseGeocodeJourneyOrigin } from "../api/journeyOrigin.service";
import { useJourneyOriginStore } from "../stores/journeyOrigin.store";
import type { JourneyOrigin } from "../types/journeyOrigin.types";

type CurrentLocation = {
  status: UserLocationStatus;
  latitude: number | null;
  longitude: number | null;
};

/**
 * Owns the unconfirmed starting-point draft used by the map picker.
 *
 * Map selections resolve a readable label while stale reverse-geocode
 * responses are ignored. Only an explicit confirmation updates the store.
 */
export default function useJourneyOriginPicker(
  businessId: number,
  currentLocation: CurrentLocation,
) {
  const storedBusinessId = useJourneyOriginStore((state) => state.businessId);
  const confirmedOrigin = useJourneyOriginStore(
    (state) => state.confirmedOrigin,
  );
  const confirmOrigin = useJourneyOriginStore((state) => state.confirmOrigin);
  const initialOrigin =
    storedBusinessId === businessId ? confirmedOrigin : null;
  const [draftOrigin, setDraftOrigin] = useState<JourneyOrigin | null>(
    initialOrigin,
  );
  const [isResolvingLabel, setIsResolvingLabel] = useState(false);
  const selectionRequestId = useRef(0);
  const currentOrigin =
    currentLocation.status === "available" &&
    currentLocation.latitude !== null &&
    currentLocation.longitude !== null
      ? {
          type: "current" as const,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          label: "Current location",
        }
      : null;
  const effectiveDraftOrigin = draftOrigin ?? currentOrigin;

  const useCurrentLocation = useCallback(
    (latitude: number, longitude: number) => {
      ++selectionRequestId.current;
      setIsResolvingLabel(false);
      setDraftOrigin({
        type: "current",
        latitude,
        longitude,
        label: "Current location",
      });
    },
    [],
  );

  const selectPlace = useCallback(
    (latitude: number, longitude: number, label: string) => {
      ++selectionRequestId.current;
      setIsResolvingLabel(false);
      setDraftOrigin({
        type: "selected",
        latitude,
        longitude,
        label,
      });
    },
    [],
  );

  const selectMapPoint = useCallback(
    async (latitude: number, longitude: number) => {
      const requestId = ++selectionRequestId.current;

      setDraftOrigin({
        type: "selected",
        latitude,
        longitude,
        label: "Selected map location",
      });
      setIsResolvingLabel(true);

      try {
        const response = await reverseGeocodeJourneyOrigin(
          latitude,
          longitude,
        );

        if (requestId !== selectionRequestId.current) {
          return;
        }

        if (!response.success) {
          setDraftOrigin({
            type: "selected",
            latitude,
            longitude,
            label: "Selected map location",
          });

          if (response.code === "RATE_LIMIT_EXCEEDED") {
            const retryAfter = response.errors?.retry_after as
              number | undefined;

            Toast.show({
              type: "error",
              text1: "Unable to get this address",
              text2: getRetryAfterMessage(retryAfter),
            });
          } else {
            Toast.show({
              type: "error",
              text1: "Unable to get this address",
              text2: "Your selected map location is still available.",
            });
          }

          return;
        }

        const label =
          response.data.address.formattedAddress.trim() ||
          "Selected map location";

        setDraftOrigin({
          type: "selected",
          latitude,
          longitude,
          label,
        });
      } catch (error) {
        if (requestId !== selectionRequestId.current) {
          return;
        }

        console.error("Failed to resolve journey origin:", error);

        setDraftOrigin({
          type: "selected",
          latitude,
          longitude,
          label: "Selected map location",
        });

        Toast.show({
          type: "error",
          text1: "Unable to get this address",
          text2: "Your selected map location is still available.",
        });
      } finally {
        if (requestId === selectionRequestId.current) {
          setIsResolvingLabel(false);
        }
      }
    },
    [],
  );

  const confirmDraft = useCallback(() => {
    if (!effectiveDraftOrigin) {
      return false;
    }

    confirmOrigin(businessId, effectiveDraftOrigin);
    return true;
  }, [businessId, confirmOrigin, effectiveDraftOrigin]);

  return {
    draftOrigin: effectiveDraftOrigin,
    isResolvingLabel,
    selectMapPoint,
    selectPlace,
    useCurrentLocation,
    confirmDraft,
  };
}
