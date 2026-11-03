import { recentBusinessDetails } from "@/features/explore/services/recentBusinessDetails.service";
import {
  useQuery,
  useQueryClient,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";
import { getQueryPersistenceApiScope } from "@/shared/query/queryPersistencePolicies";
import {
  captureOfflinePocketReadContext,
  listOfflineBusinessSnapshots,
} from "@/features/offline-pockets/services/offlinePockets.service";
import {
  getOfflineSnapshotsRevision,
  subscribeOfflineSnapshots,
} from "@/features/offline-pockets/services/offlinePocketSnapshots.events";
import { listSavedJourneys } from "@/features/offline-routes/services/savedJourneys.service";
import {
  cachedBusinessIds,
  refreshAvailabilityCaches,
} from "../services/businessAvailabilityQueryEffects";
import { businessAvailability } from "../services/businessAvailability.service";

/** Recheck saved destinations on focus/reconnect without rewriting their downloaded contents. */
export default function BusinessAvailabilitySync() {
  const auth = useAuthStore();
  const client = useQueryClient();
  const generation = useSyncExternalStore(
    (notify) => subscribeAuthSessionChanges(() => notify()),
    getAuthSessionGeneration,
  );
  const snapshotRevision = useSyncExternalStore(
    subscribeOfflineSnapshots,
    getOfflineSnapshotsRevision,
  );
  useQuery({
    queryKey: [
      "saved-business-availability",
      getQueryPersistenceApiScope(),
      auth.user?.id,
      generation,
      snapshotRevision,
    ],
    enabled: auth.isAuthenticated && !auth.isLoading,
    staleTime: 30_000,
    retry: false,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
    queryFn: async () => {
      const observation = businessAvailability.begin();
      await businessAvailability.load();
      const ids = new Set([
        ...businessAvailability.ids(),
        ...cachedBusinessIds(client),
      ]);
      const recentIds = await recentBusinessDetails.capture().listIds();
      recentIds.forEach((id) => ids.add(id));
      if (Platform.OS !== "web" && auth.user?.id) {
        const [snapshots, journeys] = await Promise.all([
          captureOfflinePocketReadContext()
            .then((context) => listOfflineBusinessSnapshots(context))
            .catch(() => []),
          listSavedJourneys(auth.user.id).catch(() => []),
        ]);
        snapshots.forEach((entry) => ids.add(entry.businessId));
        journeys.forEach((entry) => {
          if (entry.snapshot) ids.add(entry.snapshot.business.id);
        });
      }
      if (!observation.context.current()) return null;
      const previous = new Map(
        [...ids].map((id) => [id, businessAvailability.get(id)?.state]),
      );
      await businessAvailability.reconcile([...ids]);
      if (!observation.context.current()) return null;
      const changed = [...ids].filter(
        (id) => previous.get(id) !== businessAvailability.get(id)?.state,
      );
      if (auth.user?.id)
        await refreshAvailabilityCaches(client, auth.user.id, changed);
      return true;
    },
  });
  useEffect(() => {
    const stopOnline = onlineManager.subscribe((online) => {
      if (!online) businessAvailability.interrupt();
    });
    const stopFocus = focusManager.subscribe((focused) => {
      if (!focused) businessAvailability.interrupt();
    });
    return () => {
      stopOnline();
      stopFocus();
      businessAvailability.interrupt();
    };
  }, []);
  return null;
}
