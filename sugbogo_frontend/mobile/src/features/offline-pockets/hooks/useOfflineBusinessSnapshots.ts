import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useSyncExternalStore } from "react";

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
  getOfflineBusinessSnapshot,
  listOfflineBusinessSnapshots,
} from "../services/offlinePockets.service";

/** Always reads SQLite, including when React Query's network manager is offline. */
export default function useOfflineBusinessSnapshots(businessId?: number) {
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
      "offline-business-snapshots",
      OFFLINE_POCKETS_API_SCOPE,
      ownerId,
      generation,
      businessId ?? "library",
      revision,
    ],
    enabled: ownerId !== null,
    networkMode: "always",
    retry: false,
    gcTime: 0,
    staleTime: 0,
    queryFn: async () => {
      const context = await captureOfflinePocketReadContext();
      if (
        context.ownerId !== ownerId ||
        context.sessionGeneration !== generation
      ) {
        throw new Error("Offline access changed while reading device storage.");
      }
      return {
        context,
        entries:
          businessId === undefined
            ? await listOfflineBusinessSnapshots(context)
            : [
                businessId > 0
                  ? await getOfflineBusinessSnapshot(context, businessId)
                  : { businessId, status: "missing" as const, snapshot: null },
              ],
      };
    },
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (ownerId !== null) void refetch();
    }, [ownerId, refetch]),
  );
  return { ...query, ownerId };
}
