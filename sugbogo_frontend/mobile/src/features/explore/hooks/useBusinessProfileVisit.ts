import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router";
import { AppState } from "react-native";

import { useRecordBusinessProfileVisit } from "./useVisibilityMutations";
import { normalizeDiscoverySource } from "../constants/discoverySources";

/** Records displayed profile content once per business/focus experience. */
export default function useBusinessProfileVisit(
  businessId: number,
  displayedBusinessId: number | undefined,
  isOwnBusiness = false,
  profileSource: unknown = "UNKNOWN",
) {
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState(AppState.currentState);
  const attemptedId = useRef<number | null>(null);
  const { mutate } = useRecordBusinessProfileVisit();
  const discoverySource = normalizeDiscoverySource(profileSource);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isFocused) {
      attemptedId.current = null;
      return;
    }

    if (
      appState !== "active" ||
      isOwnBusiness ||
      !Number.isInteger(businessId) ||
      businessId <= 0 ||
      displayedBusinessId !== businessId ||
      attemptedId.current === businessId
    ) {
      return;
    }

    attemptedId.current = businessId;
    mutate({ businessId, discoverySource });
  }, [
    appState,
    businessId,
    displayedBusinessId,
    isFocused,
    isOwnBusiness,
    mutate,
    discoverySource,
  ]);
}
