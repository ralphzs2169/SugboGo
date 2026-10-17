import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import InfoBanner from "@/shared/components/InfoBanner";
import Skeleton from "@/shared/components/Skeleton";
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
      accessibilityLabel="Loading Plus analytics"
      accessibilityState={{ busy: true }}
      className="gap-4 py-3"
    >
      <Skeleton className="h-8 w-28 rounded" />
      <Skeleton className="h-48 w-full rounded-card" />
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
        size="section"
        title="Unable to check Plus access"
        description="Your Standard analytics are still available. Retry the access check."
        primaryActionTitle="Retry"
        onPrimaryAction={() => void access.refetch()}
      />
    );
  if (!access.allowed)
    return (
      <InfoBanner
        title="Merchant Plus access required"
        icon="lock-outline"
        actionTitle="Check access again"
        onAction={() => void access.refetch()}
      >
        <AppText className="text-sm leading-5 text-text-secondary">
          These reports require access granted by SugboGo. Your Standard
          analytics remain available.
        </AppText>
      </InfoBanner>
    );
  return (
    <View className="gap-3">
      {access.status?.access_source !== "none" && (
        <AppText className="text-sm text-text-secondary">
          {access.status?.access_source === "preview"
            ? "Plus preview access"
            : "Plus demo access"}
        </AppText>
      )}
      {children}
    </View>
  );
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
        <ErrorState
          size="section"
          title={
            hasData
              ? "Unable to refresh this report"
              : "Unable to load this report"
          }
          description={
            hasData
              ? "Previously loaded values are still shown."
              : "Please retry this section."
          }
          primaryActionTitle="Retry"
          onPrimaryAction={retry}
        />
      ) : null}
      {loading && !hasData ? <PlusAnalyticsSkeleton /> : children}
    </View>
  );
}

/** Discloses reporting coverage without equating a partial response with total failure. */
export function PlusReportContext({
  meta,
  note,
}: {
  meta: PlusAnalyticsMeta;
  note?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <InfoBanner title="About this report">
      <AppText className="text-sm leading-5 text-text-secondary">
        {formatAnalyticsDate(meta.period.start_date)} –{" "}
        {formatAnalyticsDate(meta.period.end_date)} · Asia/Manila.
        {!meta.coverage_verified
          ? " Tracking coverage is unverified; recorded observations may be incomplete."
          : " Records reflect what remains eligible at report time."}
        {meta.partial_reasons.includes("current_day_incomplete")
          ? " Today is still in progress."
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
          {expanded ? "Hide measurement details" : "Measurement details"}
        </AppText>
      </Pressable>
      {expanded && note && (
        <AppText className="text-sm leading-5 text-text-secondary">
          {note}
        </AppText>
      )}
      {expanded && (
        <AppText className="text-sm leading-5 text-text-secondary">
          Report generated {formatAnalyticsTimestamp(meta.generated_at)}.{" "}
          {meta.data_through
            ? `Data through ${formatAnalyticsTimestamp(meta.data_through)}.`
            : "Data freshness is unverified."}
        </AppText>
      )}
    </InfoBanner>
  );
}
