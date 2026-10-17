import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { getMyPockets, removeBusinessFromPocket } from "@/features/explore/api/exploreBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

export const MY_POCKETS_QUERY_KEY = ["my-pockets"] as const;

export default function useMyPockets(search: string) {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: [...MY_POCKETS_QUERY_KEY, userId, search.trim()],
    enabled: !!userId,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      throwOnApiError(await getMyPockets(pageParam, search.trim())),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
  });

  const removal = useMutation({
    mutationFn: async (businessIds: number[]) => {
      for (const businessId of businessIds) {
        throwOnApiError(await removeBusinessFromPocket(businessId));
      }
    },
    // Refetch even after partial batch failure so successful removals stay removed.
    onSettled: async (_data, _error, businessIds) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...MY_POCKETS_QUERY_KEY, userId] }),
        ...businessIds.map((id) => queryClient.invalidateQueries({
          queryKey: ["explore-business-detail", id],
        })),
        ...[
          "explore-new-businesses", "explore-discovery", "explore-recommendations",
          "explore-discovery-results", "similar-businesses", "explore-collections",
        ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      ]);
    },
  });

  return {
    ...query,
    pockets: query.data?.pages.flatMap((page) => page.items) ?? [],
    removePockets: removal.mutateAsync,
    isRemoving: removal.isPending,
  };
}
