import SegmentedControl, {
  type SegmentedControlOption,
} from "@/shared/components/SegmentedControl";

import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";

type Props = {
  period: MerchantAnalyticsPeriod;
  onChange: (period: MerchantAnalyticsPeriod) => void;
  overview?: boolean;
};

const PERIOD_OPTIONS: SegmentedControlOption<MerchantAnalyticsPeriod>[] = [
  {
    value: "7",
    label: "7 days",
    accessibilityLabel: "Last 7 days",
  },
  {
    value: "30",
    label: "30 days",
    accessibilityLabel: "Last 30 days",
  },
  {
    value: "90",
    label: "90 days",
    accessibilityLabel: "Last 90 days",
  },
];

/**
 * Provides a persistent reporting-period selector for merchant analytics.
 *
 * Uses the shared animated segmented control while preserving the
 * selected period during analytics loading, refreshes, and errors.
 */
export default function AnalyticsPeriodSelector({
  period,
  onChange,
  overview = false,
}: Props) {
  return (
    <SegmentedControl
      options={PERIOD_OPTIONS}
      value={period}
      onChange={onChange}
      className={overview ? "border border-border-primary" : "my-2"}
      variant="sm"
    />
  );
}
