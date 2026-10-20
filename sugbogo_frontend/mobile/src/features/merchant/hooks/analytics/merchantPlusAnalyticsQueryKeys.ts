import type {
  AnalyticsInterval,
  AnalyticsSelection,
  PlusReportKind,
} from "../../types/merchantPlusAnalytics.types";

export const merchantPlusStatusKey = (accountId: number | undefined) =>
  ["merchant-plus-status", accountId] as const;

export const merchantPlusReportScope = (accountId: number | undefined) =>
  ["merchant-plus-analytics", accountId] as const;

/** Includes every supported query dimension, including custom reporting boundaries. */
export function merchantPlusReportKey(
  accountId: number | undefined,
  kind: PlusReportKind,
  selection: AnalyticsSelection,
  interval: AnalyticsInterval = "weekly",
) {
  return [
    ...merchantPlusReportScope(accountId),
    kind,
    selection.period,
    selection.period === "custom" ? selection.start_date : null,
    selection.period === "custom" ? selection.end_date : null,
    interval,
    ...(selection.as_of ? [selection.as_of] : []),
  ] as const;
}
