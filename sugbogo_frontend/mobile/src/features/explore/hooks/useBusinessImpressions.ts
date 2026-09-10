import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useIsFocused } from "expo-router";
import {
  AppState,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { useRecordBusinessImpressions } from "./useVisibilityMutations";
import {
  createBusinessImpressionTracker,
  isBusinessCardVisible,
  type VisibilityRect,
} from "../utils/businessImpressions";

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

/**
 * Observes the existing nested ScrollViews without changing their rendering.
 * Layouts share the outer scroll-content coordinate space; both axes clip cards.
 */
export default function useBusinessImpressions(bottomInset: number) {
  const { mutateAsync } = useRecordBusinessImpressions();
  const submitRef = useRef(mutateAsync);
  const isFocused = useIsFocused();
  const active = useRef(false);
  const inset = useRef(bottomInset);
  const geometry = useRef({
    viewport: null as VisibilityRect | null,
    section: null as VisibilityRect | null,
    list: null as VisibilityRect | null,
    scrollY: 0,
    scrollX: 0,
    cards: new Map<number, VisibilityRect>(),
  });
  const tracker = useRef<ReturnType<typeof createBusinessImpressionTracker> | null>(
    null,
  );

  useLayoutEffect(() => {
    submitRef.current = mutateAsync;
  }, [mutateAsync]);

  useLayoutEffect(() => {
    const currentTracker = createBusinessImpressionTracker(
      (ids) => submitRef.current(ids),
    );
    tracker.current = currentTracker;

    return () => {
      active.current = false;
      currentTracker.dispose();
      tracker.current = null;
    };
  }, []);

  const updateVisibility = useCallback(() => {
    const { viewport, section, list, cards, scrollX, scrollY } = geometry.current;

    if (!active.current || !viewport || !section || !list) {
      tracker.current?.updateVisible([]);
      return;
    }

    const outerViewport = {
      x: 0,
      y: scrollY,
      width: viewport.width,
      height: Math.max(0, viewport.height - inset.current),
    };
    const listViewport = {
      x: section.x + list.x,
      y: section.y + list.y,
      width: list.width,
      height: list.height,
    };
    const visibleIds: number[] = [];

    for (const [id, card] of cards) {
      const cardRect = {
        ...card,
        x: listViewport.x + card.x - scrollX,
        y: listViewport.y + card.y,
      };

      if (isBusinessCardVisible(cardRect, [outerViewport, listViewport])) {
        visibleIds.push(id);
      }
    }

    tracker.current?.updateVisible(visibleIds);
  }, []);

  useEffect(() => {
    const updateActive = () => {
      active.current = isFocused && AppState.currentState === "active";
      updateVisibility();
    };

    updateActive();
    const subscription = AppState.addEventListener("change", updateActive);

    return () => {
      active.current = false;
      tracker.current?.updateVisible([]);
      subscription.remove();
    };
  }, [isFocused, updateVisibility]);

  useLayoutEffect(() => {
    inset.current = bottomInset;
    updateVisibility();
  }, [bottomInset, updateVisibility]);

  const onViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      geometry.current.viewport = event.nativeEvent.layout;
      updateVisibility();
    },
    [updateVisibility],
  );

  const onSectionLayout = useCallback(
    (event: LayoutChangeEvent) => {
      geometry.current.section = event.nativeEvent.layout;
      updateVisibility();
    },
    [updateVisibility],
  );

  const onListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      geometry.current.list = event.nativeEvent.layout;
      updateVisibility();
    },
    [updateVisibility],
  );

  const onVerticalScroll = useCallback(
    (event: ScrollEvent) => {
      geometry.current.scrollY = event.nativeEvent.contentOffset.y;
      updateVisibility();
    },
    [updateVisibility],
  );

  const onHorizontalScroll = useCallback(
    (event: ScrollEvent) => {
      geometry.current.scrollX = event.nativeEvent.contentOffset.x;
      updateVisibility();
    },
    [updateVisibility],
  );

  const onCardLayout = useCallback(
    (
      businessId: number,
      event: LayoutChangeEvent,
    ) => {
      geometry.current.cards.set(businessId, event.nativeEvent.layout);
      updateVisibility();
    },
    [updateVisibility],
  );

  const retainBusinesses = useCallback(
    (businessIds: number[]) => {
      const currentIds = new Set(businessIds);

      for (const id of geometry.current.cards.keys()) {
        if (!currentIds.has(id)) {
          geometry.current.cards.delete(id);
        }
      }

      updateVisibility();
    },
    [updateVisibility],
  );

  return {
    onViewportLayout,
    onSectionLayout,
    onListLayout,
    onVerticalScroll,
    onHorizontalScroll,
    onCardLayout,
    retainBusinesses,
  };
}

export type BusinessImpressionObservation = ReturnType<
  typeof useBusinessImpressions
>;
