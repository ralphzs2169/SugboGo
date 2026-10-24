import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useFocusEffect } from "expo-router";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import {
  isRecentExploreCurrent,
  readRecentExploreFeeds,
} from "../services/recentExplore.service";

/** Reads validated local data only; no Query hydration or API fetch is performed. */
export default function useRecentExplore() {
  useAuthStore();
  const grant = useOfflineAccessStore((state) => state.recentExplore);
  const current = grant && isRecentExploreCurrent(grant) ? grant : null;
  const query = useQuery({
    queryKey: [
      "local-recent-explore",
      current?.apiScope,
      current?.ownerId,
      current?.generation,
    ],
    enabled: current !== null,
    networkMode: "always",
    retry: false,
    gcTime: 0,
    staleTime: 0,
    placeholderData: (previous, previousQuery) =>
      current &&
      previousQuery?.queryKey[1] === current.apiScope &&
      previousQuery.queryKey[2] === current.ownerId
        ? previous?.filter((feed) => feed.expiresAt > Date.now())
        : undefined,
    queryFn: () =>
      current ? readRecentExploreFeeds(current) : Promise.resolve([]),
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (current) void refetch();
    }, [current, refetch]),
  );
  useEffect(() => {
    if (!current || !query.data?.length) return;
    const expiresAt = Math.min(...query.data.map((feed) => feed.expiresAt));
    const timer = setTimeout(
      () => void refetch(),
      Math.max(1, expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [query.data, current, refetch]);
  useEffect(() => {
    if (
      current &&
      query.isSuccess &&
      query.data.length === 0 &&
      isRecentExploreCurrent(current)
    ) {
      useOfflineAccessStore.getState().setRecentExplore(null);
    }
  }, [current, query.isSuccess, query.data]);
  return { ...query, grant: current, feeds: current ? (query.data ?? []) : [] };
}
