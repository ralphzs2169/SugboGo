import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import {
  getMerchantPlusPeers,
  getMerchantPlusStoredInsights,
  getMerchantPlusProfileTiming,
  getMerchantPlusRecommendations,
  refreshMerchantPlusRecommendations,
} from "../../api/merchantPlusAnalytics.service";
import type {
  AnalyticsSelection,
  MerchantPlusStatus,
} from "../../types/merchantPlusAnalytics.types";
import {
  merchantPlusReportKey,
  merchantPlusStatusKey,
} from "./merchantPlusAnalyticsQueryKeys";
import { usePlusReport } from "./useMerchantPlusAnalytics";
import { denyMerchantPlusAccess } from "./useMerchantPlusAccess";

/** Advanced reports share Core Plus ownership, cancellation and denial behavior. */
export function useMerchantPlusPeers(
  selection: AnalyticsSelection,
  enabled: boolean,
) {
  return usePlusReport("peers", selection, "weekly", enabled, (signal) =>
    getMerchantPlusPeers(selection, signal),
  );
}

/** One account-scoped cache independent of the dashboard's date selector. */
export function useMerchantPlusStoredInsights(enabled: boolean) {
  return usePlusReport(
    "review-insights",
    { period: "30" },
    "weekly",
    enabled,
    getMerchantPlusStoredInsights,
  );
}

/** Day selection is local; the report already contains all seven days and 24 hours. */
export function useMerchantPlusTiming(
  selection: AnalyticsSelection,
  enabled: boolean,
) {
  return usePlusReport("timing", selection, "daily", enabled, (signal) =>
    getMerchantPlusProfileTiming(selection, signal),
  );
}

/** Generation requires an explicit mutation. Status reads are manual, with no polling. */
export function useMerchantPlusRecommendations(
  selection: AnalyticsSelection,
  enabled: boolean,
) {
  const accountId = useAuthStore((state) => state.user?.id);
  const client = useQueryClient();
  const key = merchantPlusReportKey(accountId, "recommendations", selection);
  const scope = JSON.stringify(key);
  const pendingRefreshes = useRef(new Set<string>());
  const [cooldown, setCooldown] = useState<{
    scope: string;
    until: number;
  } | null>(null);
  const query = usePlusReport(
    "recommendations",
    selection,
    "weekly",
    enabled,
    (signal) => getMerchantPlusRecommendations(selection, signal),
  );
  const mutation = useMutation({
    mutationKey: [...key, "refresh"],
    retry: false,
    mutationFn: async (variables: {
      accountId: number;
      selection: AnalyticsSelection;
      key: typeof key;
    }) => {
      const access = client.getQueryData<MerchantPlusStatus>(
        merchantPlusStatusKey(variables.accountId),
      );
      if (
        !enabled ||
        useAuthStore.getState().user?.id !== variables.accountId ||
        !access?.has_plus_access
      ) {
        throw {
          success: false,
          code: "PLUS_REQUIRED",
          message: "Check Plus access before refreshing.",
        };
      }
      const response = await refreshMerchantPlusRecommendations(
        variables.selection,
      );
      if (
        !response.success &&
        response.code === "PLUS_REQUIRED" &&
        useAuthStore.getState().user?.id === variables.accountId
      ) {
        denyMerchantPlusAccess(client, variables.accountId);
      }
      return throwOnApiError(response);
    },
    onError: (failure, variables) => {
      const error = failure as {
        code?: string;
        errors?: { retry_after?: unknown };
      };
      const seconds = error.errors?.retry_after;
      if (
        error.code === "RATE_LIMIT_EXCEEDED" &&
        typeof seconds === "number" &&
        Number.isFinite(seconds) &&
        seconds > 0
      ) {
        setCooldown({
          scope: String(variables.accountId),
          until: Date.now() + Math.min(seconds * 1000, 2_147_483_647),
        });
      }
    },
    onSuccess: async (_result, variables) => {
      const access = client.getQueryData<MerchantPlusStatus>(
        merchantPlusStatusKey(variables.accountId),
      );
      if (
        useAuthStore.getState().user?.id === variables.accountId &&
        access?.has_plus_access
      ) {
        await client.invalidateQueries({
          queryKey: variables.key,
          exact: true,
        });
      }
    },
    onSettled: (_data, _error, variables) => {
      pendingRefreshes.current.delete(JSON.stringify(variables.key));
    },
  });
  // A late mutation response must not surface in another account or reporting selection.
  const belongsToSelection =
    mutation.variables?.accountId === accountId &&
    JSON.stringify(mutation.variables?.key) === scope;
  const refreshError = belongsToSelection ? mutation.error : null;
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(
      () => setCooldown(null),
      Math.max(0, cooldown.until - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [cooldown]);
  const isThrottled = cooldown?.scope === String(accountId);
  return {
    ...query,
    refreshError,
    refreshResult: belongsToSelection ? mutation.data : undefined,
    isRequestingRefresh: belongsToSelection && mutation.isPending,
    isThrottled,
    requestRefresh: () => {
      if (
        enabled &&
        accountId &&
        !pendingRefreshes.current.has(scope) &&
        !query.isFetching &&
        !isThrottled
      ) {
        pendingRefreshes.current.add(scope);
        mutation.mutate({ accountId, selection, key });
      }
    },
  };
}
