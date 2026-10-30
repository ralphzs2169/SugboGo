import { useCallback, useContext, useSyncExternalStore } from "react";
import {
  onlineManager,
  QueryClientContext,
  type QueryClient,
} from "@tanstack/react-query";

import {
  getAuthSessionGeneration,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { BusinessSentimentRating } from "../types/businessRating.types";
import type { ExploreBusinessDetail } from "../types/exploreBusiness.types";
import { exploreBusinessDetailKey } from "./reviewQueryKeys";

export const BUSINESS_RATING_SYNC_BUDGET_MS = 120_000;

type Observation = {
  baseline: string | null;
  startedAt: number;
  completedAt: string | null;
  watchWindow: boolean;
};
type Scope = {
  identity: string;
  observations: Map<number, Observation>;
  listeners: Set<() => void>;
};
const scopes = new WeakMap<QueryClient, Scope>();
const onlineSnapshot = () => onlineManager.isOnline();
const subscribeOnline = (notify: () => void) => onlineManager.subscribe(notify);

function scope(client: QueryClient) {
  const auth = useAuthStore.getState();
  const identity = `${getAuthSessionGeneration()}:${auth.isAuthenticated ? auth.user?.id : "signed-out"}`;
  let value = scopes.get(client);
  if (!value || value.identity !== identity) {
    value = { identity, observations: new Map(), listeners: new Set() };
    scopes.set(client, value);
  }
  return value;
}

/** Record client-known stale data separately from authoritative query DTOs. */
export function beginBusinessRatingSync(
  client: QueryClient,
  businessId: number,
  rating: BusinessSentimentRating | null | undefined,
  watchWindow = true,
) {
  if (!rating) return;
  const current = scope(client);
  const previous = current.observations.get(businessId);
  const cached = client.getQueryData<ExploreBusinessDetail>(
    exploreBusinessDetailKey(businessId),
  )?.sentiment_rating;
  const receipts = [
    rating.computed_at,
    cached?.computed_at,
    previous?.completedAt,
    previous?.baseline,
  ]
    .filter((value): value is string =>
      Boolean(value && Number.isFinite(Date.parse(value))),
    )
    .sort((left, right) => Date.parse(right) - Date.parse(left));
  current.observations.set(businessId, {
    baseline: receipts[0] ?? null,
    startedAt: Date.now(),
    completedAt: null,
    watchWindow,
  });
  current.listeners.forEach((notify) => notify());
}

/** Keep one bounded window through publication and later sentiment completion. */
export function shouldPollBusinessRating(observation: Observation | undefined) {
  return Boolean(
    observation &&
    Date.now() - observation.startedAt < BUSINESS_RATING_SYNC_BUDGET_MS &&
    (observation.watchWindow || !observation.completedAt),
  );
}

/** Reject older cached receipts after a locally observed mutation or newer receipt. */
export function guardBusinessRating(
  client: QueryClient,
  businessId: number,
  rating: BusinessSentimentRating | null | undefined,
) {
  const observation = scope(client).observations.get(businessId);
  if (!rating || !observation) return rating;
  const floor = observation.completedAt ?? observation.baseline;
  const timestamp = rating.computed_at ? Date.parse(rating.computed_at) : NaN;
  const floorTime = floor ? Date.parse(floor) : -Infinity;
  const accepted = observation.completedAt
    ? timestamp >= floorTime
    : timestamp > floorTime;
  if (accepted || rating.state === "pending" || rating.state === "unavailable")
    return rating;
  return {
    ...rating,
    value: null,
    contributing_review_count: null,
    state: "pending" as const,
  };
}

/** Remember the newest completed receipt so stale card responses stay suppressed. */
export function observeBusinessRating(
  client: QueryClient,
  businessId: number,
  rating: BusinessSentimentRating | null | undefined,
) {
  const current = scope(client);
  const observation = current.observations.get(businessId);
  if (
    !observation ||
    !rating?.computed_at ||
    (rating.state !== "ready" && rating.state !== "insufficient_data") ||
    guardBusinessRating(client, businessId, rating)?.state === "pending" ||
    (observation.completedAt &&
      Date.parse(rating.computed_at) <= Date.parse(observation.completedAt))
  )
    return false;
  current.observations.set(businessId, {
    ...observation,
    completedAt: rating.computed_at,
  });
  current.listeners.forEach((notify) => notify());
  return true;
}

/** Subscribe without fetching; cards and the existing detail observer share one scope. */
export function useBusinessRatingObservation(businessId: number) {
  const client = useContext(QueryClientContext);
  const generation = useSyncExternalStore(
    subscribeAuthSessionChanges,
    getAuthSessionGeneration,
  );
  const ownerId = useAuthStore((state) =>
    state.isAuthenticated ? state.user?.id : null,
  );
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!client) return () => undefined;
      const current = scope(client);
      current.listeners.add(notify);
      return () => {
        current.listeners.delete(notify);
      };
    },
    [client, generation, ownerId],
  );
  const snapshot = useCallback(
    () => (client ? scope(client).observations.get(businessId) : undefined),
    [businessId, client, generation, ownerId],
  );
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Keep network loss and client-known stale receipts out of numeric presentation. */
export function usePresentedBusinessRating(
  businessId: number,
  rating: BusinessSentimentRating | null | undefined,
) {
  const client = useContext(QueryClientContext);
  useBusinessRatingObservation(businessId);
  const online = useSyncExternalStore(
    subscribeOnline,
    onlineSnapshot,
    onlineSnapshot,
  );
  const current = client
    ? guardBusinessRating(client, businessId, rating)
    : rating;
  if (!current || online) return current;
  return {
    ...current,
    value: null,
    contributing_review_count: null,
    state: "unavailable" as const,
  };
}
