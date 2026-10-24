import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { AppState, type ViewToken } from "react-native";

import type { ExploreBusiness } from "../types/exploreBusiness.types";
import { createBusinessImpressionTracker } from "../utils/businessImpressions";
import { useRecordBusinessImpressions } from "./useVisibilityMutations";

const RESULTS_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 50,
};

/** Adapts the shared impression timer and batcher to FlatList viewability. */
export default function useResultsImpressions(
  enabled = true,
  businessIds?: number[],
) {
  const { mutateAsync } = useRecordBusinessImpressions();
  const submitRef = useRef(mutateAsync);
  const visibleIdsRef = useRef<number[]>([]);
  const isFocused = useIsFocused();
  const isActiveRef = useRef(false);
  const eligibleIdsRef = useRef<Set<number> | null>(null);
  const trackerRef = useRef<ReturnType<
    typeof createBusinessImpressionTracker
  > | null>(null);

  useLayoutEffect(() => {
    submitRef.current = mutateAsync;
  }, [mutateAsync]);

  useLayoutEffect(() => {
    eligibleIdsRef.current = businessIds ? new Set(businessIds) : null;
    visibleIdsRef.current = visibleIdsRef.current.filter(
      (id) => eligibleIdsRef.current === null || eligibleIdsRef.current.has(id),
    );
    trackerRef.current?.updateVisible(
      isActiveRef.current && enabled ? visibleIdsRef.current : [],
    );
  }, [businessIds, enabled]);

  useLayoutEffect(() => {
    const tracker = createBusinessImpressionTracker((ids) =>
      submitRef.current(ids),
    );
    trackerRef.current = tracker;

    return () => {
      tracker.dispose();
      trackerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const updateActiveState = () => {
      isActiveRef.current =
        enabled && isFocused && AppState.currentState === "active";
      trackerRef.current?.updateVisible(
        isActiveRef.current ? visibleIdsRef.current : [],
      );
    };

    updateActiveState();
    const subscription = AppState.addEventListener("change", updateActiveState);

    return () => {
      isActiveRef.current = false;
      trackerRef.current?.updateVisible([]);
      subscription.remove();
    };
  }, [enabled, isFocused]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<ExploreBusiness>[] }) => {
      visibleIdsRef.current = viewableItems
        .filter((token) => token.isViewable)
        .map((token) => token.item.id)
        .filter(
          (id) =>
            eligibleIdsRef.current === null || eligibleIdsRef.current.has(id),
        );

      trackerRef.current?.updateVisible(
        isActiveRef.current ? visibleIdsRef.current : [],
      );
    },
    [],
  );

  return {
    onViewableItemsChanged,
    viewabilityConfig: RESULTS_VIEWABILITY_CONFIG,
  };
}
