import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import type { BusinessChangeRequestEligibility } from "../../types/businessChangeRequestEligibility.types";

type RefetchResult = Promise<unknown>;

/**
 * Refreshes request eligibility after navigation focus and when a cooldown expires.
 *
 * The initial query remains owned by the request hook, while later focus events
 * and the server-provided expiry time keep the eligibility state current.
 */
export default function useMerchantChangeEligibilityRefresh(
  eligibility: BusinessChangeRequestEligibility | null,
  refetch: () => RefetchResult,
) {
  const hasFocused = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) {
        void refetch();
      } else {
        hasFocused.current = true;
      }
    }, [refetch]),
  );

  useEffect(() => {
    if (eligibility?.reason !== "cooldown" || !eligibility.cooldown_until) {
      return;
    }

    const remainingMilliseconds =
      new Date(eligibility.cooldown_until).getTime() - Date.now();

    if (remainingMilliseconds <= 0) {
      void refetch();
      return;
    }

    const timeout = setTimeout(() => {
      void refetch();
    }, remainingMilliseconds + 250);

    return () => clearTimeout(timeout);
  }, [eligibility, refetch]);
}
