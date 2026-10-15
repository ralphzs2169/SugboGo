import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";

import {
  currentGuidanceOwner,
  listSavedJourneys,
} from "../services/savedJourneys.service";
import { useOfflineAccessStore } from "../stores/offlineAccess.store";
import type { SavedJourneyListItem } from "../utils/savedJourney.utils";

/** Reads account-scoped device storage on focus without issuing any network request. */
export default function useSavedJourneys() {
  const authenticatedOwnerId = useAuthStore((state) =>
    state.isAuthenticated ? (state.user?.id ?? null) : null,
  );
  const offlineOwnerId = useOfflineAccessStore((state) => state.ownerId);
  const ownerId = authenticatedOwnerId ?? offlineOwnerId;
  const requestId = useRef(0);
  const [state, setState] = useState<{
    ownerId: number | null;
    items: SavedJourneyListItem[];
    isLoading: boolean;
    error: Error | null;
  }>({ ownerId: null, items: [], isLoading: true, error: null });

  const reload = useCallback(async () => {
    const request = ++requestId.current;
    setState((previous) => ({
      ownerId,
      items: previous.ownerId === ownerId ? previous.items : [],
      isLoading: true,
      error: null,
    }));
    if (!ownerId) {
      setState({ ownerId: null, items: [], isLoading: false, error: null });
      return;
    }
    try {
      const items = await listSavedJourneys(ownerId);
      if (request === requestId.current && currentGuidanceOwner() === ownerId) {
        setState({ ownerId, items, isLoading: false, error: null });
      }
    } catch {
      if (request === requestId.current) {
        setState({
          ownerId,
          items: [],
          isLoading: false,
          error: new Error("Unable to read saved guidance on this device."),
        });
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

  return {
    ownerId,
    reload,
    items: state.ownerId === ownerId ? state.items : [],
    isLoading: state.ownerId !== ownerId || state.isLoading,
    error: state.ownerId === ownerId ? state.error : null,
  };
}
