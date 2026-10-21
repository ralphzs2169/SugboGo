import { router, useIsFocused } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

import SafePressable from "@/shared/components/SafePressable";
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
function SpecialtyDetail({
  report,
  period,
  onPeriodChange,
  loading,
  error,
  retry,
}: {
  report?: PlusSpecialtyReport;
  period: MerchantAnalyticsPeriod;
  onPeriodChange: (value: MerchantAnalyticsPeriod) => void;
  loading: boolean;
  error: unknown;
  retry: () => void;
}) {
  const profile = useMerchantBusinessProfile();

  return (
    <View className="gap-4">
      {/* Specialty activity and business tag styling */}
      <AnalyticsSpecialtyTrends
        report={report}
        period={period}
        onPeriodChange={onPeriodChange}
        loading={loading}
        error={error}
        retry={retry}
        tags={
          profile.business && profile.business.id === report?.business.id
            ? profile.business.specialty_tags
            : []
        }
      />

      {/* Optional styling data failure */}
      {profile.error && (
        <ErrorState
          variant="analytics"
          title="Specialty icons and colors unavailable"
          description="Counts are still available. Specialty icons and colors could not refresh."
          primaryActionTitle="Retry"
          onPrimaryAction={() => void profile.refetch()}
        />
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
        {/* Report content uses the same background and gutters as Analytics */}
        <View className="gap-4 bg-surface px-5 pb-6 pt-5">
          {kind === "reviews" ? (
            <AnalyticsReviewPerformance
              report={reviews.data}
              period={period}
              onPeriodChange={setPeriod}
              loading={reviews.isPending}
              error={reviews.error}
              retry={() => void reviews.refetch()}
            />
          ) : kind === "specialties" ? (
            <>
              <SpecialtyDetail
                report={specialties.data}
                period={period}
                onPeriodChange={setPeriod}
                loading={specialties.isPending}
                error={specialties.error}
                retry={() => void specialties.refetch()}
              />
              {__DEV__ && (
                <SafePressable
                  onPress={() =>
                    router.push("/(merchant)/analytics/specialties-preview")
                  }
                  accessibilityLabel="Open specialty trends development preview"
                  className="min-h-11 cursor-pointer justify-center border-t border-border-primary/60 py-3"
                >
                  <AppText className="text-sm text-text-secondary">
                    Open development preview
                  </AppText>
                </SafePressable>
              )}
            </>
          ) : (
            <>
              {kind === "pocket" && (
                <AnalyticsPocketHeader
                  period={period}
                  onPeriodChange={setPeriod}
                  report={pocket.data}
                />
              )}
              {/* Initial request state */}
              {isInitialLoading ? (
                <AnalyticsPocketTrends loading retry={retry} />
              ) : hasInitialError ? (
                <ErrorState
                  variant="analytics"
                  title="Unable to load this report"
                  description="Your analytics could not be loaded. Please try again."
                  primaryActionTitle="Retry"
                  onPrimaryAction={retry}
                />
              ) : (
                <>
                  {/* Recover from failed refreshes without hiding cached data */}
                  {hasCachedError && (
                    <ErrorState
                      variant="analytics"
                      title="Unable to refresh this report"
                      description="Previously loaded information is still shown."
                      primaryActionTitle="Retry"
                      onPrimaryAction={retry}
                    />
                  )}

                  {/* Unavailable data remains distinct from recorded zero */}
                  {query.data?.meta.availability === "unavailable" ? (
                    !hasCachedError && (
                      <ErrorState
                        variant="analytics"
                        primaryActionTitle="Retry"
                        title="Report data unavailable"
                        description="This report is currently unavailable. Missing counts do not mean zero activity."
                        icon="cloud-off-outline"
                        onPrimaryAction={retry}
                      />
                    )
                  ) : (
                    <>
                      {/* Pocket trends */}
                      {kind === "pocket" && pocket.data && (
                        <AnalyticsPocketTrends
                          report={pocket.data}
                          retry={() => void pocket.refetch()}
                        />
                      )}

                      {/* No response available despite a completed request */}
                      {!query.data && (
                        <ErrorState
                          variant="analytics"
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
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
