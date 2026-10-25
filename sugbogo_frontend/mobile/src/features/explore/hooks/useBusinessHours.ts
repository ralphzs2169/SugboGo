import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

import {
  getBusinessDay,
  getBusinessHoursSummary,
  getNextBusinessHoursUpdate,
} from "../utils/businessHours.utils";

/** Keeps local hours current at boundaries, route focus and app resume. */
export default function useBusinessHours(
  operatingHours: Parameters<typeof getBusinessHoursSummary>[0],
  enabled = true,
) {
  const isFocused = useIsFocused();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled || !isFocused) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = (appState = AppState.currentState) => {
      clearTimeout(timer);
      if (appState !== "active") return;
      const current = new Date();
      setNow(current);
      if (operatingHours.length > 0) {
        timer = setTimeout(
          update,
          getNextBusinessHoursUpdate(operatingHours, current) -
            current.getTime(),
        );
      }
    };
    update();
    const subscription = AppState.addEventListener("change", update);
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [enabled, isFocused, operatingHours]);

  return {
    ...getBusinessHoursSummary(operatingHours, now),
    currentDay: getBusinessDay(now),
  };
}
