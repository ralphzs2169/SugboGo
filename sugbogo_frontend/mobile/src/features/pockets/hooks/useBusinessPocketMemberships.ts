import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getBusinessPocketMemberships } from "../api/pockets.service";
import { businessPocketMembershipsQueryKey } from "./pocketQueryKeys";

/** Reads the authoritative full selection each time a business picker opens. */
export default function useBusinessPocketMemberships(
  businessId: number | null,
) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const validId =
    typeof businessId === "number" &&
    Number.isSafeInteger(businessId) &&
    businessId > 0
      ? businessId
      : null;
  const isEnabled =
    authenticated && userId !== null && !isAuthLoading && validId !== null;
  const query = useQuery({
    queryKey: businessPocketMembershipsQueryKey(
      isEnabled ? userId : null,
      validId,
    ),
    enabled: isEnabled,
    refetchOnMount: "always",
    queryFn: async () => {
      const session = useAuthStore.getState();
      if (
        !isEnabled ||
        validId === null ||
        session.isLoading ||
        !session.isAuthenticated ||
        session.user?.id !== userId
      ) {
        throw new Error("Sign in to manage your Pockets.");
      }
      return throwOnApiError(await getBusinessPocketMemberships(validId));
    },
  });
  return {
    memberships:
      isEnabled && query.isFetchedAfterMount ? (query.data ?? null) : null,
    isEnabled,
    userId,
    isAuthLoading,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
