import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
} from "@/shared/api/authSessionGeneration.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getMerchantBusinessStatus } from "../../api/merchantBusinessProfile.service";

export const merchantBusinessStatusKey = (ownerId?: number) =>
  ["merchant-business-status", ownerId] as const;

/** Deduplicate owner status reads and reject responses from replaced authenticated sessions. */
export default function useMerchantBusinessStatus() {
  const auth = useAuthStore();
  const ownerId = auth.user?.id;
  const enabled =
    auth.isAuthenticated && !auth.isLoading && auth.user?.role === "merchant";
  const query = useQuery({
    queryKey: [
      ...merchantBusinessStatusKey(ownerId),
      getAuthSessionGeneration(),
    ],
    enabled,
    staleTime: 15_000,
    retry: false,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
    queryFn: async ({ signal }) => {
      const generation = getAuthSessionGeneration();
      const status = throwOnApiError(await getMerchantBusinessStatus(signal));
      if (
        !isAuthSessionCurrent(generation) ||
        useAuthStore.getState().user?.id !== ownerId
      )
        throw new Error("Business status belongs to an earlier session.");
      return status;
    },
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (enabled) void refetch({ cancelRefetch: false });
    }, [enabled, refetch]),
  );
  return { ...query };
}
