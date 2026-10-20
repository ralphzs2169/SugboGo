import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getMerchantPlusStatus } from "../../api/merchantPlusAnalytics.service";
import type { MerchantPlusStatus } from "../../types/merchantPlusAnalytics.types";
import {
  merchantPlusReportScope,
  merchantPlusStatusKey,
} from "./merchantPlusAnalyticsQueryKeys";

/** Treats an authoritative report denial as a downgrade across all Plus observers. */
export function denyMerchantPlusAccess(client: QueryClient, accountId: number) {
  // A status request started before the denial must not restore stale access later.
  void client.cancelQueries({ queryKey: merchantPlusStatusKey(accountId) });
  client.setQueryData<MerchantPlusStatus>(
    merchantPlusStatusKey(accountId),
    (status) =>
      status
        ? {
            ...status,
            has_plus_access: false,
            effective_tier: "standard",
            access_source: "none",
          }
        : status,
  );
  void client.cancelQueries({ queryKey: merchantPlusReportScope(accountId) });
  client.removeQueries({ queryKey: merchantPlusReportScope(accountId) });
}

/** Shares account-scoped server access, fails closed, and purges revoked report data. */
export default function useMerchantPlusAccess() {
  const accountId = useAuthStore((state) => state.user?.id);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: merchantPlusStatusKey(accountId),
    queryFn: async ({ signal }) =>
      throwOnApiError(await getMerchantPlusStatus(signal)),
    enabled: !!accountId,
    staleTime: 60_000,
    refetchOnMount: "always",
    retry: false,
  });
  const allowed =
    !!accountId && !query.error && query.data?.has_plus_access === true;

  useEffect(() => {
    if (accountId && !allowed) {
      void client.cancelQueries({
        queryKey: merchantPlusReportScope(accountId),
      });
      client.removeQueries({ queryKey: merchantPlusReportScope(accountId) });
    }
  }, [accountId, allowed, client]);

  return {
    accountId,
    allowed,
    status: query.data,
    state: query.error
      ? ("error" as const)
      : !query.data
        ? ("loading" as const)
        : allowed
          ? ("accessible" as const)
          : ("restricted" as const),
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

export type MerchantPlusAccess = ReturnType<typeof useMerchantPlusAccess>;
