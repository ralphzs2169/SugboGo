import { QueryClient } from "@tanstack/react-query";
import { invalidateMerchantAnalytics } from "../invalidateMerchantAnalytics";
import {
  merchantStandardAnalyticsKey,
  merchantDiscoverySourcesKey,
  merchantRoutePlanningKey,
  merchantUnansweredReviewsKey,
} from "../merchantAnalyticsQueryKeys";
import { merchantPlusReportKey } from "../merchantPlusAnalyticsQueryKeys";

describe("scoped Merchant analytics dependencies", () => {
  it.each(["reply", "classification", "business_name"] as const)(
    "invalidates only %s dependencies across periods and accounts",
    async (change) => {
      const client = new QueryClient({
        defaultOptions: { queries: { gcTime: Infinity } },
      });
      const keys = [
        merchantStandardAnalyticsKey(42, "7"),
        merchantStandardAnalyticsKey(42, "30"),
        merchantUnansweredReviewsKey(42),
        merchantDiscoverySourcesKey(42, "30"),
        merchantRoutePlanningKey(42, "30"),
        ...(
          [
            "visibility",
            "pocket",
            "specialties",
            "reviews",
            "peers",
            "review-insights",
            "timing",
            "recommendations",
          ] as const
        ).flatMap((kind) => [
          merchantPlusReportKey(42, kind, { period: "30" }),
          merchantPlusReportKey(42, kind, {
            period: "custom",
            start_date: "2026-01-01",
            end_date: "2026-02-01",
          }),
          merchantPlusReportKey(99, kind, { period: "30" }),
        ]),
      ];
      for (const key of keys) client.setQueryData(key, {});
      await invalidateMerchantAnalytics(client, 42, change);
      for (const key of keys) {
        const kind = String(key[2]);
        const expected =
          key[1] === 42 &&
          (change === "business_name" ||
            (key[0] === "merchant-standard-analytics" &&
              (change !== "classification" || kind !== "unanswered-reviews") &&
              !["discovery-sources", "route-planning"].includes(kind)) ||
            (key[0] === "merchant-plus-analytics" &&
              (change === "reply"
                ? ["reviews", "recommendations"]
                : ["specialties", "peers", "recommendations"]
              ).includes(kind)));
        expect({
          key,
          invalidated: client.getQueryState(key)?.isInvalidated,
        }).toEqual({ key, invalidated: expected });
      }
      client.clear();
    },
  );
});
