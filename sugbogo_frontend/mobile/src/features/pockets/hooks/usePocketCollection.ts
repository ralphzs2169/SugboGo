import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getPocketCollection } from "../api/pockets.service";
import { pocketCollectionQueryKey } from "./pocketQueryKeys";

/** Loads owned collection metadata without sharing data or requests between accounts. */
export default function usePocketCollection(
  collectionId: number | null | undefined,
) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const validCollectionId =
    typeof collectionId === "number" &&
    Number.isSafeInteger(collectionId) &&
    collectionId > 0
      ? collectionId
      : null;
  const isEnabled =
    isAuthenticated &&
    userId !== null &&
    !isAuthLoading &&
    validCollectionId !== null;

  const query = useQuery({
    queryKey: pocketCollectionQueryKey(
      isEnabled ? userId : null,
      validCollectionId,
    ),
    enabled: isEnabled,
    queryFn: async () => {
      if (validCollectionId === null) {
        throw new Error("Select a valid Pocket.");
      }
      const session = useAuthStore.getState();
      // Manual refetches and retries must still belong to this query's owner.
      if (
        !isEnabled ||
        !session.isAuthenticated ||
        session.isLoading ||
        session.user?.id !== userId
      ) {
        throw new Error("Sign in to view your Pockets.");
      }
      return throwOnApiError(await getPocketCollection(validCollectionId));
    },
  });

  return {
    collection: isEnabled ? (query.data ?? null) : null,
    hasData: isEnabled && query.data !== undefined,
    userId,
    isEnabled,
    isAuthLoading,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}
