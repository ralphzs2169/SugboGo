import { useQuery, onlineManager } from "@tanstack/react-query";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useFocusEffect } from "expo-router";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import {
  getAuthSessionGeneration,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";
import { getQueryPersistenceApiScope } from "@/shared/query/queryPersistencePolicies";
import {
  availabilityOwner,
  businessAvailability,
} from "../services/businessAvailability.service";

/** Share persisted availability receipts while current network checks remain separate from local reads. */
export default function useBusinessAvailability(
  ids: number[],
  { check = true } = {},
) {
  useAuthStore();
  useOfflineAccessStore();
  const generation = useSyncExternalStore(
    (notify) => subscribeAuthSessionChanges(() => notify()),
    getAuthSessionGeneration,
  );
  const revision = useSyncExternalStore(
    businessAvailability.subscribe,
    businessAvailability.revision,
  );
  const ownerId = availabilityOwner();
  const apiScope = getQueryPersistenceApiScope();
  const normalized = [
    ...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0)),
  ].sort((a, b) => a - b);
  const identity = normalized.join(",");
  const online = useSyncExternalStore(
    (notify) => onlineManager.subscribe(() => notify()),
    () => onlineManager.isOnline(),
  );
  const authenticated = useAuthStore(
    (state) => state.isAuthenticated && !state.isLoading,
  );
  const local = useQuery({
    queryKey: ["local-business-availability", apiScope, ownerId, generation],
    queryFn: async () => {
      await businessAvailability.load();
      return true;
    },
    enabled: ownerId !== null,
    networkMode: "always",
    retry: false,
    staleTime: Infinity,
  });
  const query = useQuery({
    queryKey: [
      "business-availability",
      apiScope,
      ownerId,
      generation,
      identity,
    ],
    queryFn: async () => {
      await businessAvailability.reconcile(normalized);
      return true;
    },
    enabled:
      check && authenticated && ownerId !== null && normalized.length > 0,
    staleTime: 30_000,
    retry: false,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (check && authenticated && ownerId !== null && identity)
        void refetch({ cancelRefetch: false });
    }, [check, authenticated, ownerId, identity, refetch]),
  );
  // Re-read disk on owner restoration; no status failure can turn a listing into active.
  useEffect(() => {
    if (ownerId !== null) void local.refetch();
  }, [ownerId, generation]); // eslint-disable-line react-hooks/exhaustive-deps
  const get = useCallback(
    (businessId: number) =>
      ownerId === null ? undefined : businessAvailability.get(businessId),
    [ownerId],
  );
  return {
    revision,
    get,
    error: query.error ?? local.error,
    isChecking: query.isFetching,
    online,
    refetch,
  };
}
