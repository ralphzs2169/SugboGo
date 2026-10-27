import type { QueryClient } from "@tanstack/react-query";
import { merchantStandardAnalyticsScope } from "./merchantAnalyticsQueryKeys";
import {
  merchantPlusReportFamily,
  merchantPlusReportScope,
} from "./merchantPlusAnalyticsQueryKeys";

/** Refresh derived reports across periods, preserving unrelated event reports. */
export function invalidateMerchantAnalytics(
  client: QueryClient,
  accountId: number,
  change: "reply" | "classification" | "business_name",
) {
  const standard = client.invalidateQueries({
    queryKey: merchantStandardAnalyticsScope(accountId),
    // Standard's extra event reports contain no reply or specialty measures.
    predicate:
      change === "business_name"
        ? undefined
        : (query) =>
            !["discovery-sources", "route-planning"].includes(
              String(query.queryKey[2]),
            ) &&
            (change !== "classification" ||
              query.queryKey[2] !== "unanswered-reviews"),
  });
  if (change === "business_name") {
    // All Plus responses embed the current business name.
    return Promise.all([
      standard,
      client.invalidateQueries({
        queryKey: merchantPlusReportScope(accountId),
      }),
    ]);
  }
  const kinds =
    change === "reply"
      ? (["reviews", "recommendations"] as const)
      : (["specialties", "peers", "recommendations"] as const);
  return Promise.all([
    standard,
    ...kinds.map((kind) =>
      client.invalidateQueries({
        queryKey: merchantPlusReportFamily(accountId, kind),
      }),
    ),
  ]);
}
