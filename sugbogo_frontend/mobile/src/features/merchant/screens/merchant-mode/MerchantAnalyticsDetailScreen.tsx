import { useIsFocused } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import InfoBanner from "@/shared/components/InfoBanner";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

import AnalyticsChartEmptyState from "../../components/analytics/AnalyticsChartEmptyState";
import AnalyticsDetailHeader, {
  ANALYTICS_DETAIL_DESCRIPTIONS,
} from "../../components/analytics/AnalyticsDetailHeader";
import AnalyticsPocketTrends, {
  AnalyticsPocketHeader,
} from "../../components/analytics/AnalyticsPocketTrends";
import AnalyticsReviewPerformance from "../../components/analytics/AnalyticsReviewPerformance";
import AnalyticsSpecialtyTrends from "../../components/analytics/AnalyticsSpecialtyTrends";

import {
  useMerchantPlusPocket,
  useMerchantPlusReviews,
  useMerchantPlusSpecialties,
} from "../../hooks/analytics/useMerchantPlusAnalytics";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";

import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import type {
  CorePlusDetailKind,
  PlusDetailKind,
  PlusSpecialtyReport,
} from "../../types/merchantPlusAnalytics.types";

import MerchantAdvancedAnalyticsDetailScreen from "./MerchantAdvancedAnalyticsDetailScreen";

export const PLUS_DETAIL_TITLES: Record<PlusDetailKind, string> = {
  pocket: "Pocket trends",
  specialties: "Specialty trends",
  reviews: "Review performance",
  peers: "Peer comparisons",
  "review-insights": "Review insights",
  timing: "Profile visit timing",
  recommendations: "Business recommendations",
};

export function isPlusDetailKind(value: unknown): value is PlusDetailKind {
  return typeof value === "string" && Object.hasOwn(PLUS_DETAIL_TITLES, value);
}

type DetailScreenProps = {
  kind: PlusDetailKind;
  initialPeriod?: MerchantAnalyticsPeriod;
};

type CoreDetailScreenProps = {
  kind: CorePlusDetailKind;
  initialPeriod?: MerchantAnalyticsPeriod;
};

/**
 * Routes merchant analytics reports to their corresponding
 * detail screens while preserving existing route contracts.
 *
 * Core reports load without a frontend Plus access check.
 */
export default function MerchantAnalyticsDetailScreen({
  kind,
  initialPeriod = "30",
}: DetailScreenProps) {
  if (kind === "pocket" || kind === "specialties" || kind === "reviews") {
    return (
      <CoreAnalyticsDetailScreen kind={kind} initialPeriod={initialPeriod} />
    );
  }

  return (
    <MerchantAdvancedAnalyticsDetailScreen
      kind={kind}
      initialPeriod={initialPeriod}
      title={PLUS_DETAIL_TITLES[kind]}
    />
  );
}

/**
 * Renders specialty activity using matching business
 * tag styling, with independent recovery if profile
 * information cannot be loaded.
 */
function SpecialtyDetail({ report }: { report: PlusSpecialtyReport }) {
  const profile = useMerchantBusinessProfile();

  return (
    <View className="gap-4">
      {/* Specialty activity and business tag styling */}
      <AnalyticsSpecialtyTrends
        report={report}
        tags={
          profile.business?.id === report.business.id
            ? profile.business.specialty_tags
            : []
        }
      />

      {/* Optional styling data failure */}
      {profile.error && (
        <InfoBanner
          title="Specialty icons and colors unavailable"
          actionTitle="Retry"
          onAction={() => void profile.refetch()}
        >
          <AppText className="text-sm leading-5 text-text-secondary">
            Counts are still available. Specialty icons and colors could not
            refresh.
          </AppText>
        </InfoBanner>
      )}
    </View>
  );
}

/**
 * Displays a focused merchant analytics report with
 * period filtering, refresh, and section-level recovery.
 *
 * Preserves cached report content on refresh failures and
 * avoids repeating the fixed Pocket Trends page title.
 */
function CoreAnalyticsDetailScreen({
  kind,
  initialPeriod = "30",
}: CoreDetailScreenProps) {
  const [period, setPeriod] = useState<MerchantAnalyticsPeriod>(initialPeriod);
  const [refreshing, setRefreshing] = useState(false);

  const insets = useSafeAreaInsets();
  const focused = useIsFocused();

  const selection = { period };

  // Each report remains independently cached by React Query.
  const pocket = useMerchantPlusPocket(selection, focused && kind === "pocket");

  const specialties = useMerchantPlusSpecialties(
    selection,
    focused && kind === "specialties",
  );

  const reviews = useMerchantPlusReviews(
    selection,
    focused && kind === "reviews",
  );

  const query =
    kind === "pocket" ? pocket : kind === "specialties" ? specialties : reviews;

  const retry = () => void query.refetch();

  // Report errors remain visible to the page and user.
  useQueryErrorNotification({
    error: focused ? query.error : null,
    toastId: `analytics-detail-${kind}`,
    title: "Unable to load analytics",
    fallbackMessage: "Please retry this report.",
  });

  // Refresh only the active report.
  const refresh = async () => {
    if (refreshing) return;

    setRefreshing(true);

    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const isInitialLoading = query.isPending && !query.data;
  const hasInitialError = Boolean(query.error && !query.data);
  const hasCachedError = Boolean(query.error && query.data);

  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-surface">
      {/* Scrollable report beneath the fixed navigation header */}
      <ScrollView
        testID="analytics-detail-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={theme.extends.colors.brand}
            colors={[theme.extends.colors.brand]}
          />
        }
      >
        {/* Report description and segmented reporting period */}
        {kind !== "pocket" && (
          <AnalyticsDetailHeader
            title={PLUS_DETAIL_TITLES[kind]}
            description={ANALYTICS_DETAIL_DESCRIPTIONS[kind]}
            period={period}
            onPeriodChange={setPeriod}
          />
        )}

        {/* Report content uses the same background and gutters as Analytics */}
        <View className="gap-4 bg-surface px-5 pb-6 pt-5">
          {kind === "pocket" && (
            <AnalyticsPocketHeader
              period={period}
              onPeriodChange={setPeriod}
              report={pocket.data}
            />
          )}
          {/* Initial request state */}
          {isInitialLoading ? (
            kind === "pocket" ? (
              <AnalyticsPocketTrends loading retry={retry} />
            ) : (
              <View
                accessibilityRole="progressbar"
                className="min-h-48 items-center justify-center gap-3"
              >
                <ActivityIndicator
                  size="large"
                  color={theme.extends.colors.brand}
                />
                <AppText className="text-sm text-text-secondary">
                  Loading report…
                </AppText>
              </View>
            )
          ) : hasInitialError ? (
            <ErrorState
              size="section"
              title="Unable to load this report"
              description="Your analytics could not be loaded. Please try again."
              primaryActionTitle="Retry"
              onPrimaryAction={retry}
            />
          ) : (
            <>
              {/* Recover from failed refreshes without hiding cached data */}
              {hasCachedError && (
                <InfoBanner
                  title="Report couldn't refresh"
                  actionTitle="Retry"
                  onAction={retry}
                >
                  <AppText className="text-sm leading-5 text-text-secondary">
                    Showing previously loaded information. Try again to get the
                    latest data.
                  </AppText>
                </InfoBanner>
              )}

              {/* Unavailable data remains distinct from recorded zero */}
              {query.data?.meta.availability === "unavailable" ? (
                <AnalyticsChartEmptyState
                  title="Report data unavailable"
                  description="This report is currently unavailable. Missing counts do not mean zero activity."
                  icon="cloud-off-outline"
                  onRetry={retry}
                />
              ) : (
                <>
                  {/* Pocket trends */}
                  {kind === "pocket" && pocket.data && (
                    <AnalyticsPocketTrends
                      report={pocket.data}
                      retry={() => void pocket.refetch()}
                    />
                  )}

                  {/* Specialty trends */}
                  {kind === "specialties" && specialties.data && (
                    <SpecialtyDetail report={specialties.data} />
                  )}

                  {/* Review performance */}
                  {kind === "reviews" && reviews.data && (
                    <AnalyticsReviewPerformance report={reviews.data} />
                  )}

                  {/* No response available despite a completed request */}
                  {!query.data && (
                    <ErrorState
                      size="section"
                      title="Report unavailable"
                      description="No report information was returned. Please try again."
                      primaryActionTitle="Retry"
                      onPrimaryAction={retry}
                    />
                  )}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
