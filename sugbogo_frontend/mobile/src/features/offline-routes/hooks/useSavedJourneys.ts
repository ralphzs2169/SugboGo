import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";

import {
  currentGuidanceOwner,
  listSavedJourneys,
} from "../services/savedJourneys.service";
import { useOfflineAccessStore } from "../stores/offlineAccess.store";
import type { SavedJourneyListItem } from "../utils/savedJourney.utils";

type JourneyState = {
  ownerId: number | null;
  items: SavedJourneyListItem[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: Error | null;
};

/** Reads account-scoped device storage without network requests. */
export default function useSavedJourneys() {
  const authenticatedOwnerId = useAuthStore((state) =>
    state.isAuthenticated ? (state.user?.id ?? null) : null,
  );
  const offlineOwnerId = useOfflineAccessStore((state) => state.ownerId);
  const ownerId = authenticatedOwnerId ?? offlineOwnerId;

  const requestId = useRef(0);

  const [state, setState] = useState<JourneyState>({
    ownerId: null,
    items: [],
    isLoading: true,
    hasLoaded: false,
    error: null,
  });

  const reload = useCallback(async () => {
    const request = ++requestId.current;

    setState((previous) => {
      const sameOwner = previous.ownerId === ownerId;

      return {
        ownerId,
        items: sameOwner ? previous.items : [],
        hasLoaded: sameOwner ? previous.hasLoaded : false,
        isLoading: true,
        error: null,
      };
    });

    if (!ownerId) {
      if (request === requestId.current) {
        setState({
          ownerId: null,
          items: [],
          isLoading: false,
          hasLoaded: false,
          error: null,
        });
      }
      return;
    }

    try {
      const items = await listSavedJourneys(ownerId);

      if (request === requestId.current && currentGuidanceOwner() === ownerId) {
        setState({
          ownerId,
          items,
          isLoading: false,
          hasLoaded: true,
          error: null,
        });
      }
    } catch {
      if (request === requestId.current) {
        setState((previous) => ({
          ownerId,
          items: previous.ownerId === ownerId ? previous.items : [],
          hasLoaded: previous.ownerId === ownerId ? previous.hasLoaded : false,
          isLoading: false,
          error: new Error("Unable to read saved guidance on this device."),
        }));
      }
    }
  }, [ownerId]);

  useFocusEffect(
    useCallback(() => {
      void reload();

      return () => {
        requestId.current += 1;
      };
    }, [reload]),
  );

  const sameOwner = state.ownerId === ownerId;
  const hasLoaded = sameOwner && state.hasLoaded;
  const isLoading = !sameOwner || state.isLoading;

  return {
    ownerId,
    reload,
    items: sameOwner ? state.items : [],
    isLoading,
    isInitialLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading && hasLoaded,
    hasLoaded,
    error: sameOwner ? state.error : null,
  };
}
