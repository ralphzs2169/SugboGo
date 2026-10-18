import { standardAnalyticsReport } from "../../__tests__/merchantAnalytics.fixtures";
import {
  pocketReport,
  reviewReport,
  visibilityReport,
} from "../../__tests__/merchantPlusAnalytics.fixtures";
import { merchantPlusReportKey } from "../../hooks/analytics/merchantPlusAnalyticsQueryKeys";
import {
  formatKpiTrend,
  replyRateTrend,
  reviewCountTrend,
  visibilityKpiTrend,
} from "../merchantKpiComparisons.utils";

describe("backend-approved KPI comparisons", () => {
  it.each([3, -3, 0])(
    "displays a signed absolute review change of %s without calculating growth",
    (value) => {
      const report = reviewReport();
      report.published_review_count_change = {
        value,
        direction: value > 0 ? "up" : value < 0 ? "down" : "unchanged",
        unit: "count",
        reason: null,
      };
      const trend = reviewCountTrend(standardAnalyticsReport(), report);
      expect(trend?.value).toBe(value);
      expect(formatKpiTrend(trend!)).toBe(
        value === 0 ? "No change" : value > 0 ? "+3" : "−3",
      );
    },
  );

  it("allows a zero review cohort but omits unavailable, older, or mismatched reports", () => {
    const standard = standardAnalyticsReport();
    const plus = reviewReport();
    standard.reviews.new_published_in_period = 0;
    standard.reviews.period_eligible_published = 0;
    standard.reviews.period_replied_published = 0;
    standard.reviews.reply_rate = null;
    plus.current.published_review_count = 0;
    plus.published_review_count_change = {
      value: -4,
      direction: "down",
      unit: "count",
      reason: null,
    };
    expect(reviewCountTrend(standard, plus)?.value).toBe(-4);
    plus.meta.period.end_exclusive = "2026-10-17T04:00:01+00:00";
    expect(reviewCountTrend(standard, plus)).toBeUndefined();
    expect(reviewCountTrend(standard, null)).toBeUndefined();
  });

  it("requires coverage evidence even if event totals and a numerical change are supplied", () => {
    const standard = standardAnalyticsReport();
    const plus = visibilityReport();
    const metric = plus.metrics.profile_visits;
    metric.change = {
      value: 20,
      direction: "up",
      unit: "percent",
      reason: null,
    };
    metric.previous_value = 20;
    expect(
      visibilityKpiTrend(standard, plus, "profile_visits"),
    ).toBeUndefined();
    metric.sources.current.coverage_verified = true;
    metric.sources.previous.coverage_verified = true;
    metric.comparison_eligibility = {
      eligible: true,
      reason: null,
      reasons: [],
      definition_version: "test-proof",
    };
    expect(
      formatKpiTrend(visibilityKpiTrend(standard, plus, "profile_visits")!),
    ).toBe("+20%");
    metric.value = 25;
    expect(
      visibilityKpiTrend(standard, plus, "profile_visits"),
    ).toBeUndefined();
  });

  it("matches recorded SAVE counts instead of current Pocket holders", () => {
    const standard = standardAnalyticsReport();
    const plus = pocketReport();
    const metric = plus.metrics.saves;
    metric.value = standard.saves_in_period;
    metric.previous_value = 10;
    metric.change = {
      value: -50,
      direction: "down",
      unit: "percent",
      reason: null,
    };
    metric.sources.current.coverage_verified = true;
    metric.sources.previous.coverage_verified = true;
    metric.comparison_eligibility = {
      eligible: true,
      reason: null,
      reasons: [],
      definition_version: "test-proof",
    };
    expect(formatKpiTrend(visibilityKpiTrend(standard, plus, "saves")!)).toBe(
      "−50%",
    );
    metric.value = standard.current_pocket_holders;
    expect(visibilityKpiTrend(standard, plus, "saves")).toBeUndefined();
  });

  it("retains reply percentage points and rejects incorrect comparison units or directions", () => {
    const plus = reviewReport();
    expect(
      formatKpiTrend(replyRateTrend(standardAnalyticsReport(), plus)!),
    ).toBe("+25 pp");
    plus.reply_rate_change.unit = "percent";
    expect(replyRateTrend(standardAnalyticsReport(), plus)).toBeUndefined();
    plus.reply_rate_change.unit = "percentage_points";
    plus.reply_rate_change.direction = "down";
    expect(replyRateTrend(standardAnalyticsReport(), plus)).toBeUndefined();
  });

  it("isolates reporting cutoffs and accounts in the existing query cache", () => {
    const selection = {
      period: "30" as const,
      as_of: "2026-10-17T04:00:00+00:00",
    };
    const key = merchantPlusReportKey(42, "reviews", selection);
    expect(key).not.toEqual(merchantPlusReportKey(43, "reviews", selection));
    expect(key).not.toEqual(
      merchantPlusReportKey(42, "reviews", {
        ...selection,
        as_of: "2026-10-17T04:00:01+00:00",
      }),
    );
  });

  it("rejects other businesses, unavailable sources, and mismatched reply cutoffs", () => {
    const standard = standardAnalyticsReport();
    const plus = reviewReport();
    plus.published_review_count_change = {
      value: 1,
      direction: "up",
      unit: "count",
      reason: null,
    };
    plus.business.id = 999;
    expect(reviewCountTrend(standard, plus)).toBeUndefined();
    plus.business.id = standard.business.id;
    plus.meta.availability = "unavailable";
    expect(reviewCountTrend(standard, plus)).toBeUndefined();
    plus.meta.availability = "partial";
    plus.reply_cutoff = "2026-10-17T04:00:01+00:00";
    expect(replyRateTrend(standard, plus)).toBeUndefined();
    expect(reviewCountTrend(standard, plus)?.value).toBe(1);
  });
});
