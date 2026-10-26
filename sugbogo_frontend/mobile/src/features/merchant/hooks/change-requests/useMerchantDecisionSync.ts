import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { merchantBusinessNameChangeKeys } from "../business-name-change/businessNameChangeQueryKeys";
import { merchantClassificationChangeKeys } from "../classification-change/classificationChangeQueryKeys";
import { merchantLocationChangeKeys } from "../location-change/locationChangeQueryKeys";
import { businessChangePendingStatusQueryKey } from "./businessChangePendingStatusQueryKey";
import { merchantBusinessProfileKey } from "../business-profile/merchantBusinessProfileQueryKeys";
import type { MerchantBusinessProfileResponse } from "../../types/merchantBusinessProfile.types";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import { ROAD_ROUTE_QUERY_KEY } from "@/features/explore/hooks/useRoadRoute";
import { DIRECT_JOURNEYS_QUERY_KEY } from "@/features/explore/hooks/useDirectJourneys";
import { DIRECT_JOURNEY_MAP_QUERY_KEY } from "@/features/explore/hooks/useDirectJourneyMap";
import { invalidateMerchantAnalytics } from "../analytics/invalidateMerchantAnalytics";
import { merchantRecentActivityKey } from "../dashboard/merchantDashboardQueryKeys";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getMerchantBusinessProfile } from "../../api/merchantBusinessProfile.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

const families = {
  business_name: merchantBusinessNameChangeKeys,
  classification: merchantClassificationChangeKeys,
  location: merchantLocationChangeKeys,
};
type Family = keyof typeof families;
type Decision = { id: number; status: string };
// Per QueryClient lifetime, rather than a module-global account latch. Multiple
// mounted observers share a decision without invalidating each other forever.
const observed = new WeakMap<QueryClient, Set<string>>();
const pendingObserved = new WeakMap<QueryClient, Set<string>>();

export function syncMerchantDecision(
  client: QueryClient,
  accountId: number,
  family: Family,
  request: Decision,
) {
  if (!["approved", "rejected", "withdrawn"].includes(request.status))
    return Promise.resolve();
  let handled = observed.get(client);
  if (!handled) {
    handled = new Set();
    observed.set(client, handled);
  }
  const token = `${accountId}:${family}:${request.id}:${request.status}`;
  if (handled.has(token)) return Promise.resolve();
  handled.add(token);
  const keys = families[family];
  const work: Promise<unknown>[] = [
    client.invalidateQueries({
      queryKey: keys.list(accountId),
      refetchType: "all",
    }),
    client.invalidateQueries({ queryKey: keys.detail(accountId, request.id) }),
    client.invalidateQueries({
      queryKey: businessChangePendingStatusQueryKey(accountId),
    }),
  ];
  if (request.status === "approved") {
    const profileKey = merchantBusinessProfileKey(accountId);
    const profile =
      client.getQueryData<MerchantBusinessProfileResponse>(profileKey);
    work.push(client.invalidateQueries({ queryKey: profileKey }));
    function refreshBusinessViews(businessId: number) {
      return Promise.all([
        client.invalidateQueries({
          queryKey: exploreBusinessDetailKey(businessId),
        }),
        ...(family === "location"
          ? [
              ROAD_ROUTE_QUERY_KEY,
              DIRECT_JOURNEYS_QUERY_KEY,
              DIRECT_JOURNEY_MAP_QUERY_KEY,
            ].map((prefix) =>
              client.invalidateQueries({ queryKey: [...prefix, businessId] }),
            )
          : []),
      ]);
    }
    if (profile) {
      work.push(refreshBusinessViews(profile.id));
    } else if (useAuthStore.getState().user?.id === accountId) {
      // Cold notification entry can precede the owner profile. Resolve its owned
      // business before targeting cached public detail and location routes.
      work.push(
        client
          .fetchQuery({
            queryKey: profileKey,
            queryFn: async () =>
              throwOnApiError(await getMerchantBusinessProfile()),
          })
          .then((loaded) => {
            if (useAuthStore.getState().user?.id !== accountId) return;
            return refreshBusinessViews(loaded.id);
          })
          .catch(() => {
            // The query retains the failure for profile recovery; a later request
            // observation may retry this dependent refresh.
            observed.get(client)?.delete(token);
          }),
      );
    }
    if (family !== "location") {
      work.push(invalidateMerchantAnalytics(client, accountId, family));
      // The snapshot embeds the business name and uses current active specialty
      // assignments when selecting retained vouch activity.
      work.push(
        client.invalidateQueries({
          queryKey: merchantRecentActivityKey(accountId),
        }),
      );
    }
  }
  return Promise.all(work);
}

/** Observe authoritative successful reads from details and every loaded history page. */
export default function useMerchantDecisionSync(
  requests: readonly Decision[],
  accountId: number | undefined,
  family: Family,
  isSuccess: boolean,
) {
  const client = useQueryClient();
  useEffect(() => {
    if (!accountId || !isSuccess) return;
    let pending = pendingObserved.get(client);
    if (!pending) {
      pending = new Set();
      pendingObserved.set(client, pending);
    }
    requests.forEach((request, index) => {
      const token = `${accountId}:${family}:${request.id}`;
      if (request.status === "pending") {
        pending.add(token);
      } else if (index === 0 || pending.has(token)) {
        // Old history pages must not trigger one refetch cascade per historical
        // decision. A newly observed detail or a known pending transition does.
        pending.delete(token);
        void syncMerchantDecision(client, accountId, family, request);
      }
    });
  }, [requests, accountId, family, isSuccess, client]);
}
