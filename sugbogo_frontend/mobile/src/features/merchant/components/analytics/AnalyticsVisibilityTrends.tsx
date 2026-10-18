import { useIsFocused } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import type { MerchantPlusAccess } from "../../hooks/analytics/useMerchantPlusAccess";
import { useMerchantPlusVisibility } from "../../hooks/analytics/useMerchantPlusAnalytics";
import MerchantContentSection from "../../layout/MerchantContentSection";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import type {
  AnalyticsInterval,
  VisibilityMetric,
} from "../../types/merchantPlusAnalytics.types";
import AnalyticsChoiceChips from "./AnalyticsChoiceChips";
import AnalyticsEventTrend from "./AnalyticsEventTrend";
import { PlusAccessGate, PlusRequestState } from "./AnalyticsPlusStates";

const METRICS = [
  { value: "profile_visits", label: "Profile visits" },
  { value: "impressions", label: "Impressions" },
  { value: "distinct_profile_visitors", label: "Visitor accounts" },
] as const;

/** Owns the overview's primary chart while leaving Standard sections independent. */
export default function AnalyticsVisibilityTrends({
  period,
  access,
}: {
  period: MerchantAnalyticsPeriod;
  access: MerchantPlusAccess;
}) {
  const focused = useIsFocused();
  const [metric, setMetric] = useState<VisibilityMetric>("profile_visits");
  const [intervalSelections, setIntervalSelections] = useState<
    Partial<Record<MerchantAnalyticsPeriod, AnalyticsInterval>>
  >({});
  const interval =
    intervalSelections[period] ?? (period === "90" ? "weekly" : "daily");
  const selectInterval = (selected: AnalyticsInterval) => {
    setIntervalSelections((current) => ({
      ...current,
      [period]: selected,
    }));
  };
  const query = useMerchantPlusVisibility(
    { period },
    interval,
    access.allowed && focused,
  );
  useQueryErrorNotification({
    error: focused ? query.error : null,
    toastId: "plus-visibility-error",
    title: "Unable to load visibility",
    fallbackMessage: "Please retry this section.",
  });
  const title = METRICS.find((option) => option.value === metric)!.label;

  return (
    <MerchantContentSection
      title="Visibility Trends"
      accessory={
        <AppText weight="bold" className="text-sm text-brand">
          Plus
        </AppText>
      }
    >
      <PlusAccessGate access={access}>
        <View className="gap-4">
          {/* Switching metrics reuses the same report; only interval/period changes fetch. */}
          <AnalyticsChoiceChips
            label="Show"
            options={METRICS}
            value={metric}
            onChange={setMetric}
          />
          <AnalyticsChoiceChips
            label="Group by"
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
            ]}
            value={interval}
            onChange={selectInterval}
          />
          <PlusRequestState
            error={query.error}
            hasData={!!query.data}
            loading={query.isPending}
            retry={() => void query.refetch()}
          >
            {query.data && (
              <AnalyticsEventTrend
                metric={query.data.metrics[metric]}
                label={`Recorded ${title.toLowerCase()}`}
                interval={query.data.interval}
                note={query.data.measurement_note}
                retry={() => void query.refetch()}
              />
            )}
          </PlusRequestState>
        </View>
      </PlusAccessGate>
    </MerchantContentSection>
  );
}
