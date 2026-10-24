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
  getOfflineBusinessSnapshot,
  listOfflineBusinessSnapshots,
  listOfflineBusinessCovers,
} from "../services/offlinePockets.service";
import { offlineCoverFileUri } from "../services/offlinePocketCoverFiles";

/** Always reads SQLite, including when React Query's network manager is offline. */
export default function useOfflineBusinessSnapshots(
  businessId?: number,
  enabled = true,
) {
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
    enabled: enabled && ownerId !== null,
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
      const entries =
        businessId === undefined
          ? await listOfflineBusinessSnapshots(context)
          : [
              businessId > 0
                ? await getOfflineBusinessSnapshot(context, businessId)
                : { businessId, status: "missing" as const, snapshot: null },
            ];
      const covers: Record<number, string> = {};
      try {
        const images = await listOfflineBusinessCovers(context);
        await Promise.all(
          images
            .filter((image) =>
              entries.some(
                (entry) =>
                  entry.businessId === image.businessId &&
                  entry.status === "available",
              ),
            )
            .map(async (image) => {
              const uri = await offlineCoverFileUri(context, image.fileName);
              if (uri) covers[image.businessId] = uri;
            }),
        );
      } catch {
        // Optional image metadata/files must never hide readable business information.
      }
      return { context, entries, covers };
    },
  });
  useEffect(() => {
    if (__DEV__ && query.error) {
      console.warn(
        "[Offline Pockets] Business snapshot read failed:",
        query.error,
      );
    }
  }, [query.error]);
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (enabled && ownerId !== null) void refetch();
    }, [enabled, ownerId, refetch]),
  );
  return { ...query, ownerId };
}
