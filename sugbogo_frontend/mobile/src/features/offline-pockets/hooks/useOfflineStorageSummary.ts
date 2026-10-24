import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import { OFFLINE_POCKETS_API_SCOPE } from "../constants/offlinePockets.constants";
import {
  getOfflineSnapshotsRevision,
  subscribeOfflineSnapshots,
} from "../services/offlinePocketSnapshots.events";
import {
  captureOfflinePocketReadContext,
  currentOfflineBusinessOwner,
  readOfflinePocketStorageSummary,
} from "../services/offlinePockets.service";

/** Reads local business management state independently of internet reachability. */
export default function useOfflineStorageSummary() {
  useAuthStore();
  useOfflineAccessStore();
  const ownerId = currentOfflineBusinessOwner();
  const generation = getAuthSessionGeneration();
  const revision = useSyncExternalStore(
    subscribeOfflineSnapshots,
    getOfflineSnapshotsRevision,
    getOfflineSnapshotsRevision,
  );
  const query = useQuery({
    queryKey: [
      "offline-storage-summary",
      OFFLINE_POCKETS_API_SCOPE,
      ownerId,
      generation,
      revision,
    ],
    enabled: ownerId !== null,
    networkMode: "always",
    retry: false,
    gcTime: 0,
    queryFn: async () => {
      const context = await captureOfflinePocketReadContext();
      if (
        context.ownerId !== ownerId ||
        context.sessionGeneration !== generation
      )
        throw new Error("Offline access changed.");
      return { context, ...(await readOfflinePocketStorageSummary(context)) };
    },
  });
  useEffect(() => {
    if (__DEV__ && query.error) {
      console.warn(
        "[Offline Storage] Business summary read failed:",
        query.error,
      );
    }
  }, [query.error]);
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (ownerId !== null) void refetch();
    }, [ownerId, refetch]),
  );
  return { ...query, ownerId };
}
