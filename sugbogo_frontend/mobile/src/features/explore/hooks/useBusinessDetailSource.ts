import { focusManager, onlineManager } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import useOfflineBusinessSnapshots from "@/features/offline-pockets/hooks/useOfflineBusinessSnapshots";
import { OFFLINE_BUSINESS_SNAPSHOT_VERSION } from "@/features/offline-pockets/constants/offlinePockets.constants";
import {
  getAuthSessionGeneration,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";
import { getQueryPersistenceApiScope } from "@/shared/query/queryPersistencePolicies";
import {
  recentBusinessDetails,
  RECENT_BUSINESS_LIMITS,
  type RecentBusinessDetail,
} from "../services/recentBusinessDetails.service";
import {
  canUseBusinessDetailFallback,
  isBusinessDetailDenied,
} from "../utils/businessDetailAvailability";
import useExploreBusinessProfile from "./useExploreBusinessProfile";

function subscribeOnline(notify: () => void) {
  return onlineManager.subscribe(notify);
}
function subscribeSession(notify: () => void) {
  return subscribeAuthSessionChanges(() => notify());
}

/** Owns source selection; presentation never guesses from Pocket flags or worker state. */
export default function useBusinessDetailSource(businessId: number) {
  const live = useExploreBusinessProfile(businessId);
  const online = useSyncExternalStore(subscribeOnline, () =>
    onlineManager.isOnline(),
  );
  const ownerId = useAuthStore((state) =>
    state.isAuthenticated && !state.isLoading ? (state.user?.id ?? null) : null,
  );
  const generation = useSyncExternalStore(
    subscribeSession,
    getAuthSessionGeneration,
  );
  const apiScope = getQueryPersistenceApiScope();
  const session = useMemo(() => {
    const captured = recentBusinessDetails.capture();
    return captured.ownerId === ownerId &&
      captured.generation === generation &&
      captured.apiScope === apiScope
      ? captured
      : null;
  }, [ownerId, generation, apiScope]);
  const current = session?.isAuthorized() ?? false;
  const denied = isBusinessDetailDenied(live.error);
  const isLive =
    current &&
    live.business?.id === businessId &&
    !live.error &&
    !live.isPaused &&
    online;
  const mayFallback =
    current &&
    !denied &&
    !isLive &&
    (!live.error ||
      canUseBusinessDetailFallback(live.error) ||
      live.isPaused ||
      !online);
  const pocket = useOfflineBusinessSnapshots(businessId, mayFallback);
  const readIdentity = useMemo(
    () => ({ session, businessId, mayFallback }),
    [session, businessId, mayFallback],
  );
  const [recent, setRecent] = useState<{
    identity: typeof readIdentity;
    detail: RecentBusinessDetail | null;
  } | null>(null);

  useEffect(() => {
    const { session, businessId, mayFallback } = readIdentity;
    if (!mayFallback || !session) return;
    let cancelled = false;
    void session.get(businessId).then((detail) => {
      if (!cancelled && session.isAuthorized()) {
        setRecent({ identity: readIdentity, detail });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [readIdentity]);

  useEffect(() => {
    // Review synchronization can also fetch this same authoritative query key.
    if (denied && session) void session.remove(businessId);
  }, [denied, session, businessId]);

  const entry = pocket.data?.entries[0];
  const readablePocket =
    mayFallback &&
    pocket.ownerId === ownerId &&
    pocket.data?.context.apiScope === apiScope &&
    pocket.data?.context.sessionGeneration === generation &&
    entry?.status === "available" &&
    entry.snapshot.business.id === businessId
      ? entry.snapshot
      : null;

  useEffect(() => {
    if (readablePocket && session) void session.remove(businessId);
  }, [readablePocket, session, businessId]);

  const recentReady = recent?.identity === readIdentity;
  const detail = recentReady ? recent.detail : null;
  const [now, setNow] = useState(() => Date.now());
  const recentExpiresAt = detail
    ? Date.parse(detail.fetchedAt) + RECENT_BUSINESS_LIMITS.maxAgeMs
    : 0;

  useEffect(() => {
    if (!detail) return;
    const recheckExpiry = () => setNow(Date.now());
    // Recheck after the asynchronous read, then once at the original deadline.
    recheckExpiry();
    const timer = setTimeout(
      recheckExpiry,
      Math.max(0, recentExpiresAt - Date.now()),
    );
    const stopFocus = focusManager.subscribe((focused) => {
      if (focused) recheckExpiry();
    });
    return () => {
      clearTimeout(timer);
      stopFocus();
    };
  }, [detail, recentExpiresAt]);

  const pocketPending =
    mayFallback &&
    pocket.ownerId === ownerId &&
    pocket.isPending &&
    !pocket.isError;
  const snapshot =
    readablePocket ??
    (mayFallback && detail && now < recentExpiresAt
      ? {
          formatVersion: OFFLINE_BUSINESS_SNAPSHOT_VERSION,
          fetchedAt: detail.fetchedAt,
          business: detail.business,
        }
      : null);
  const source = isLive
    ? "live"
    : readablePocket
      ? "offline-pocket"
      : snapshot
        ? "recent"
        : "unavailable";
  const isLoading =
    !isLive &&
    !snapshot &&
    !denied &&
    current &&
    ((mayFallback && (pocketPending || !recentReady)) ||
      (live.isLoading && !live.isPaused && online));

  return {
    source,
    business: isLive ? live.business : null,
    snapshot,
    localCoverUri: readablePocket
      ? pocket.data?.covers?.[businessId]
      : undefined,
    error: live.error,
    isLoading,
    isFetching: live.isFetching,
    refetch: live.refetch,
  };
}
