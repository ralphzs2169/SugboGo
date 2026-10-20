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
import type { AnalyticsSelection } from "../../types/merchantPlusAnalytics.types";
import { merchantPlusReportKey } from "./merchantPlusAnalyticsQueryKeys";
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
  const [cooldownClock, setCooldownClock] = useState(() => Date.now());
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
      if (
        !enabled ||
        useAuthStore.getState().user?.id !== variables.accountId
      ) {
        throw {
          success: false,
          code: "AUTHENTICATION_REQUIRED",
          message: "Sign in to request recommendations.",
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
      // A new error without retry timing must not inherit an expired deadline.
      setCooldown(null);
      if (
        error.code === "RATE_LIMIT_EXCEEDED" &&
        typeof seconds === "number" &&
        Number.isFinite(seconds) &&
        seconds > 0
      ) {
        setCooldownClock(Date.now());
        setCooldown({
          scope: String(variables.accountId),
          until: Date.now() + Math.min(seconds * 1000, 2_147_483_647),
        });
      }
    },
    onSuccess: async (_result, variables) => {
      if (useAuthStore.getState().user?.id === variables.accountId) {
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
  const accountCooldown =
    cooldown?.scope === String(accountId) ? cooldown : null;
  const cooldownRemainingSeconds = accountCooldown
    ? Math.max(0, Math.ceil((accountCooldown.until - cooldownClock) / 1000))
    : 0;
  const isThrottled = cooldownRemainingSeconds > 0;
  const expiredRateLimit =
    accountCooldown !== null &&
    !isThrottled &&
    (mutation.error as { code?: string } | null)?.code ===
      "RATE_LIMIT_EXCEEDED";
  const refreshError =
    belongsToSelection && !expiredRateLimit ? mutation.error : null;
  useEffect(() => {
    if (!cooldown || cooldown.until <= Date.now()) return;
    // Use the deadline, rather than decrementing, so suspended apps catch up correctly.
    const timer = setInterval(() => {
      const now = Date.now();
      setCooldownClock(now);
      if (now >= cooldown.until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);
  return {
    ...query,
    refreshError,
    refreshResult: belongsToSelection ? mutation.data : undefined,
    isRequestingRefresh: belongsToSelection && mutation.isPending,
    isThrottled,
    cooldownRemainingSeconds,
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
