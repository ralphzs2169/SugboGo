import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import InfoBanner from "@/shared/components/InfoBanner";
import { AnalyticsChartSkeleton } from "./AnalyticsLoadingSkeletons";
import type { MerchantPlusAccess } from "../../hooks/analytics/useMerchantPlusAccess";
import type { PlusAnalyticsMeta } from "../../types/merchantPlusAnalytics.types";
import {
  formatAnalyticsDate,
  formatAnalyticsTimestamp,
} from "../../utils/merchantAnalytics.utils";

/** Reserves chart structure without hiding screen headers or reporting controls. */
export function PlusAnalyticsSkeleton() {
  return (
    <View
      accessibilityLabel="Loading analytics"
      accessibilityState={{ busy: true }}
      className="gap-4 py-3"
    >
      <AnalyticsChartSkeleton />
    </View>
  );
}

/** Keeps entitlement failures distinct from restrictions and empty analytics. */
export function PlusAccessGate({
  access,
  children,
}: {
  access: MerchantPlusAccess;
  children: ReactNode;
}) {
  if (access.state === "loading") return <PlusAnalyticsSkeleton />;
  if (access.state === "error")
    return (
      <ErrorState
        variant="analytics"
        title="Unable to check report access"
        description="Your other analytics are still available. Retry the access check."
        primaryActionTitle="Retry"
        onPrimaryAction={() => void access.refetch()}
      />
    );
  if (!access.allowed)
    return (
      <InfoBanner
        title="Report access unavailable"
        icon="lock-outline"
        actionTitle="Check access again"
        onAction={() => void access.refetch()}
      >
        <AppText className="text-sm leading-5 text-text-secondary">
          These reports require access granted by SugboGo. Your other analytics
          remain available.
        </AppText>
      </InfoBanner>
    );
  return <View className="gap-3">{children}</View>;
}

/** Localizes request recovery and preserves cached content after a failed refresh. */
export function PlusRequestState({
  error,
  hasData,
  loading,
  retry,
  children,
}: {
  error: unknown;
  hasData: boolean;
  loading: boolean;
  retry: () => void;
  children: ReactNode;
}) {
  return (
    <View className="gap-4">
      {error ? (
        hasData ? (
          <ErrorState
            variant="analytics"
            title="Unable to refresh this report"
            description="Previously loaded values are still shown."
            primaryActionTitle="Retry"
            onPrimaryAction={retry}
          />
        ) : (
          <ErrorState
            variant="analytics"
            primaryActionTitle="Retry"
            title="Unable to load this report"
            description="Analytics cannot currently be displayed. Please retry this section."
            icon="cloud-off-outline"
            onPrimaryAction={retry}
          />
        )
      ) : null}
      {loading && !hasData ? <PlusAnalyticsSkeleton /> : children}
    </View>
  );
}

/** Keeps report dates visible and measurement definitions behind an expandable explanation. */
export function PlusReportContext({
  meta,
  note,
  children,
}: {
  meta: PlusAnalyticsMeta;
  note?: string;
  children?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View className="gap-2">
      {/* Dates and meaningful availability limits remain visible. */}
      <AppText className="text-sm leading-5 text-text-secondary">
        {formatAnalyticsDate(meta.period.start_date)} –{" "}
        {formatAnalyticsDate(meta.period.end_date)} · Manila time.
        {!meta.coverage_verified ? " Some activity may not be recorded." : ""}
        {meta.partial_reasons.includes("current_day_incomplete")
          ? " Today is still in progress."
          : ""}
        {meta.partial_reasons.some((reason) =>
          [
            "total_read_unavailable",
            "series_read_unavailable",
            "visibility_read_unavailable",
          ].includes(reason),
        )
          ? " Some figures could not be loaded. Available figures are shown."
          : ""}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={
          expanded
            ? "Hide Plus measurement details"
            : "Show Plus measurement details"
        }
        onPress={() => setExpanded(!expanded)}
        className="min-h-12 justify-center self-start py-2 active:opacity-70"
      >
        <AppText weight="semibold" className="text-sm text-text-info">
          {expanded ? "Hide measurement details" : "About these numbers"}
        </AppText>
      </Pressable>
      {expanded && (
        <View className="gap-2 border-t border-border-primary pt-3">
          {/* Free-form server notes are retained without attempting to rewrite them. */}
          {note && (
            <AppText className="text-sm leading-5 text-text-secondary">
              {note}
            </AppText>
          )}
          {meta.partial_reasons.includes("current_state_reporting") && (
            <AppText className="text-sm leading-5 text-text-secondary">
              Counts reflect records that still qualify today. Earlier results
              can change when reviews or vouches are removed or their status
              changes.
            </AppText>
          )}
          {children}
          <AppText className="text-sm leading-5 text-text-secondary">
            Report prepared {formatAnalyticsTimestamp(meta.generated_at)} ·
            Manila time.{" "}
            {meta.data_through
              ? `Data available through ${formatAnalyticsTimestamp(meta.data_through)} · Manila time.`
              : "The latest data time could not be verified."}
          </AppText>
        </View>
      )}
    </View>
  );
}
