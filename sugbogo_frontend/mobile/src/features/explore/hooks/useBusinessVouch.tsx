import {
  type InfiniteData,
  type QueryClient,
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getExploreBusinessDetail,
  removeBusinessSpecialtyVouch,
  vouchForBusinessSpecialty,
} from "../api/exploreBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getInstallationId } from "@/shared/api/storage.service";
import { API_ERROR_CODE } from "@/shared/constants/errorCodes";
import { COMMUNITY_REVIEWS_QUERY_KEY } from "@/features/community/hooks/communityReviewQueryKeys";
import { DISCOVERY_FEED_QUERY_KEY } from "./useDiscoveryFeed";
import { RECOMMENDATIONS_QUERY_KEY } from "./useRecommendations";
import { OPEN_NOW_BUSINESSES_QUERY_KEY } from "../constants/exploreHomepageQueries";
import { DISCOVERY_RESULTS_QUERY_KEY } from "./useDiscoveryResults";
import { SIMILAR_BUSINESSES_QUERY_KEY } from "./useSimilarBusinesses";
import { EXPLORE_COLLECTIONS_QUERY_KEY } from "./useExploreCollection";
import { VOUCH_HISTORY_QUERY_KEY } from "@/features/profile/hooks/vouchHistoryQueryKeys";
import { ACTIVITY_TIMELINE_QUERY_KEY } from "@/features/profile/hooks/activityTimelineQueryKeys";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
} from "./reviewQueryKeys";
import type {
  ExploreBusiness,
  ExploreBusinessDetail,
  ExploreBusinessListResponse,
} from "../types/exploreBusiness.types";

type VouchVariables = {
  tagId: number;
  isVouched: boolean;
};

type Intent = {
  businessId: number;
  tagId: number;
  confirmed: boolean;
  desired: boolean;
  version: number;
  cancellation: Promise<void[]>;
};

type WriteGroup = {
  intents: Map<string, Intent>;
  businessIds: Set<number>;
};

const VOUCH_MUTATION_KEY = ["business-specialty-vouch"] as const;
// Survive sheet dismissal/remounts while staying scoped to this QueryClient.
const writeGroups = new WeakMap<QueryClient, WriteGroup>();
const flatKeys = [
  ["explore-new-businesses"],
  DISCOVERY_FEED_QUERY_KEY,
  RECOMMENDATIONS_QUERY_KEY,
] as const;
const paginatedKeys = [
  DISCOVERY_RESULTS_QUERY_KEY,
  EXPLORE_COLLECTIONS_QUERY_KEY,
];

function cacheKeys(businessId: number) {
  return [
    ["explore-business-detail", businessId],
    ...flatKeys,
    ...paginatedKeys,
    SIMILAR_BUSINESSES_QUERY_KEY,
  ];
}

/** Changes only one reaction; counts follow the displayed state, not tap count. */
function setVouchState(
  client: QueryClient,
  businessId: number,
  tagId: number,
  selected: boolean,
) {
  const updateBusiness = <
    T extends Pick<ExploreBusiness, "id" | "specialty_tags">,
  >(
    business: T,
  ): T => {
    if (business.id !== businessId) return business;
    return {
      ...business,
      specialty_tags: business.specialty_tags.map((tag) => {
        if (tag.id !== tagId || tag.is_vouched === selected) return tag;
        return {
          ...tag,
          is_vouched: selected,
          vouch_count: Math.max(0, tag.vouch_count + (selected ? 1 : -1)),
        };
      }),
    };
  };
  const updateFeed = (
    feed: ExploreBusinessListResponse,
  ): ExploreBusinessListResponse => ({
    ...feed,
    items: feed.items.map(updateBusiness),
  });

  client.setQueryData<ExploreBusinessDetail>(
    ["explore-business-detail", businessId],
    (current) => (current ? updateBusiness(current) : current),
  );
  for (const queryKey of flatKeys) {
    client.setQueriesData<ExploreBusinessListResponse>(
      { queryKey },
      (current) => (current ? updateFeed(current) : current),
    );
  }
  for (const queryKey of paginatedKeys) {
    client.setQueriesData<InfiniteData<ExploreBusinessListResponse>>(
      { queryKey },
      (current) =>
        current
          ? {
              ...current,
              pages: current.pages.map(updateFeed),
            }
          : current,
    );
  }
  client.setQueriesData<ExploreBusiness[]>(
    { queryKey: SIMILAR_BUSINESSES_QUERY_KEY },
    (current) => current?.map(updateBusiness),
  );
}

function hasUncertainOutcome(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return (
    code === API_ERROR_CODE.REQUEST_TIMEOUT ||
    code === API_ERROR_CODE.NETWORK_ERROR ||
    code === API_ERROR_CODE.UNKNOWN_ERROR
  );
}

/**
 * Applies every tap immediately and serializes writes only within one specialty.
 * Later taps replace the desired state; server responses never repaint older intent.
 */
export default function useBusinessVouch({
  businessId,
}: {
  businessId: number;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: VOUCH_MUTATION_KEY,
    retry: false,
    mutationFn: async (intent: Intent) => {
      try {
        await intent.cancellation;
        while (intent.desired !== intent.confirmed) {
          const target = intent.desired;
          const version = intent.version;
          try {
            const response = target
              ? await vouchForBusinessSpecialty(
                  intent.businessId,
                  intent.tagId,
                  await getInstallationId(),
                )
              : await removeBusinessSpecialtyVouch(
                  intent.businessId,
                  intent.tagId,
                );
            throwOnApiError(response);
            intent.confirmed = target;
          } catch (error) {
            if (hasUncertainOutcome(error)) {
              // A timeout may already have committed. Read before another write.
              const detail = throwOnApiError(
                await getExploreBusinessDetail(intent.businessId),
              );
              const tag = detail.specialty_tags.find(
                (item) => item.id === intent.tagId,
              );
              if (!tag) throw error;
              intent.confirmed = tag.is_vouched;
              if (intent.desired === intent.confirmed) break;
            }
            // An obsolete failure must not roll back a newer tap. Process that
            // newer intent once; never automatically retry a rejected same intent.
            if (intent.version !== version) continue;
            throw error;
          }
        }
      } catch (error) {
        setVouchState(
          queryClient,
          intent.businessId,
          intent.tagId,
          intent.confirmed,
        );
        throw error;
      } finally {
        // Remove synchronously before promise continuations can accept a new tap.
        writeGroups
          .get(queryClient)
          ?.intents.delete(intent.businessId + ":" + intent.tagId);
      }
    },
    onSettled: () => {
      const group = writeGroups.get(queryClient);
      if (!group || group.intents.size > 0) return;
      writeGroups.delete(queryClient);
      // Reconcile after all specialties drain, without making the UI wait.
      void Promise.all([
        ...[
          COMMUNITY_REVIEWS_QUERY_KEY,
          OPEN_NOW_BUSINESSES_QUERY_KEY,
          ACTIVITY_TIMELINE_QUERY_KEY,
          VOUCH_HISTORY_QUERY_KEY,
          ["explore-new-businesses"],
          DISCOVERY_FEED_QUERY_KEY,
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        ...Array.from(group.businessIds).flatMap((id) => [
          queryClient.invalidateQueries({
            queryKey: businessReviewPreviewKey(id),
          }),
          queryClient.invalidateQueries({ queryKey: businessReviewsKey(id) }),
          queryClient.invalidateQueries({
            queryKey: ["explore-business-detail", id],
          }),
        ]),
      ]);
    },
  });

  const pendingTagIds = useMutationState({
    filters: { mutationKey: VOUCH_MUTATION_KEY, status: "pending" },
    select: (entry) => entry.state.variables as Intent,
  })
    .filter((intent) => intent.businessId === businessId)
    .map((intent) => intent.tagId);

  function vouch(
    variables: VouchVariables,
    onAccepted?: () => void,
  ): Promise<void> {
    const group = writeGroups.get(queryClient) ?? {
      intents: new Map<string, Intent>(),
      businessIds: new Set<number>(),
    };
    const key = businessId + ":" + variables.tagId;
    const existing = group.intents.get(key);
    // Pending intent is authoritative even if React hasn't rendered the last tap.
    const cachedTag = queryClient
      .getQueryData<ExploreBusinessDetail>([
        "explore-business-detail",
        businessId,
      ])
      ?.specialty_tags.find((tag) => tag.id === variables.tagId);
    const current =
      existing?.desired ?? cachedTag?.is_vouched ?? variables.isVouched;
    const desired = !current;
    const cancellation = Promise.all(
      cacheKeys(businessId).map((queryKey) =>
        queryClient.cancelQueries({ queryKey }),
      ),
    );
    setVouchState(queryClient, businessId, variables.tagId, desired);

    if (existing) {
      existing.desired = desired;
      existing.version += 1;
      existing.cancellation = cancellation;
      if (desired) onAccepted?.();
      // Only the original caller owns this drain's error notification.
      return Promise.resolve();
    }

    const intent: Intent = {
      businessId,
      tagId: variables.tagId,
      confirmed: current,
      desired,
      version: 0,
      cancellation,
    };
    group.intents.set(key, intent);
    group.businessIds.add(businessId);
    writeGroups.set(queryClient, group);
    const promise = mutation.mutateAsync(intent);
    if (desired) onAccepted?.();
    return promise;
  }

  return {
    vouch,
    pendingTagIds,
    pendingTagId: pendingTagIds[0] ?? null,
    error: mutation.error,
  };
}
