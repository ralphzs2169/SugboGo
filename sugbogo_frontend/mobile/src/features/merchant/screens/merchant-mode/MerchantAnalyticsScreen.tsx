import { useIsFocused, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import InfoBanner from "@/shared/components/InfoBanner";
import SafePressable from "@/shared/components/SafePressable";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";

import AnalyticsActivityOverview from "../../components/analytics/AnalyticsActivityOverview";
import AnalyticsCurrentSnapshot from "../../components/analytics/AnalyticsCurrentSnapshot";
import AnalyticsPeriodSelector from "../../components/analytics/AnalyticsPeriodSelector";
import AnalyticsMoreInsights from "../../components/analytics/AnalyticsMoreInsights";
import AnalyticsVisibilityTrends from "../../components/analytics/AnalyticsVisibilityTrends";
import AnalyticsSectionSkeleton from "../../components/analytics/AnalyticsSectionSkeleton";
import AnalyticsSourceNotice from "../../components/analytics/AnalyticsSourceNotice";
import AnalyticsSpecialtySupport from "../../components/analytics/AnalyticsSpecialtySupport";
import useMerchantStandardAnalytics from "../../hooks/analytics/useMerchantStandardAnalytics";
import useMerchantPlusAccess from "../../hooks/analytics/useMerchantPlusAccess";
import { merchantPlusReportScope } from "../../hooks/analytics/merchantPlusAnalyticsQueryKeys";
import type { PlusDetailKind } from "../../types/merchantPlusAnalytics.types";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import MerchantContentSection from "../../layout/MerchantContentSection";
import MerchantScreenHeader from "../../layout/MerchantScreenHeader";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import {
  formatAnalyticsCount,
  formatAnalyticsDate,
  formatAnalyticsTimestamp,
} from "../../utils/merchantAnalytics.utils";

/**
 * Presents owned-business Standard analytics with persistent filters and localized recovery.
 * Plus visibility and lazy detail reports share server-derived access independently of Standard.
 */
export default function MerchantAnalyticsScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const queryClient = useQueryClient();
  const plusAccess = useMerchantPlusAccess();
  const [isRefreshingPlus, setIsRefreshingPlus] = useState(false);
  const bottomSpacing = useTabBarSpacing(24);
  const [period, setPeriod] = useState<MerchantAnalyticsPeriod>("30");
  const { report, isLoading, isRefetching, error, refetch } =
    useMerchantStandardAnalytics(period);
  const {
    business,
    error: profileError,
    refetch: refetchProfile,
  } = useMerchantBusinessProfile();
  const specialtyTags =
    business?.id === report?.business.id
      ? (business?.specialty_tags ?? [])
      : [];

  useQueryErrorNotification({
    error,
    toastId: "merchant-standard-analytics-error",
    title: "Unable to load analytics",
    fallbackMessage: "Please try again.",
  });

  useQueryErrorNotification({
    error: focused ? plusAccess.error : null,
    toastId: "merchant-plus-access-error",
    title: "Unable to check Plus access",
    fallbackMessage: "Your Standard analytics remain available.",
  });

  const retry = () => {
    void refetch();
  };
  const refreshPlus = async () => {
    setIsRefreshingPlus(true);
    try {
      const access = await plusAccess.refetch();
      if (!access.error && access.data?.has_plus_access) {
        await queryClient.refetchQueries({
          queryKey: merchantPlusReportScope(plusAccess.accountId),
          type: "active",
        });
      }
    } finally {
      setIsRefreshingPlus(false);
    }
  };
  const refresh = () => {
    void Promise.all([refetch(), refetchProfile(), refreshPlus()]);
  };
  const openPlusDetail = (kind: PlusDetailKind) => {
    if (!plusAccess.allowed) return;
    router.push({
      pathname: "/(merchant)/analytics/[report]",
      params: { report: kind, period },
    });
  };
  const showPeriodLoading = isLoading || (!report && !error);
  const unanswered = report?.reviews.current_unanswered_published;
  const showUnanswered =
    report &&
    report.sources.domain.availability !== "unavailable" &&
    unanswered !== undefined &&
    unanswered > 0;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      {/* Stable merchant header and reporting controls */}
      <MerchantScreenHeader title="Analytics" />
      <View className="bg-surface px-5 pb-2 pt-2">
        <AppText className="text-sm text-text-secondary">
          See how your business is performing
        </AppText>
        <AnalyticsPeriodSelector period={period} onChange={setPeriod} />
      </View>

      <ScrollView
        testID="merchant-analytics-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomSpacing }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || isRefreshingPlus}
            onRefresh={refresh}
            tintColor={theme.extends.colors.brand}
            colors={[theme.extends.colors.brand]}
          />
        }
      >
        <View className="bg-background">
          {/* Recoverable request failure, including failed cached refreshes */}
          {(error || showUnanswered) && (
            <View className="gap-3 bg-surface px-5 pb-4 pt-3">
              {error && (
                <ErrorState
                  size="section"
                  title={
                    report
                      ? "Unable to refresh analytics"
                      : "Unable to load analytics"
                  }
                  description={
                    report
                      ? "Previously loaded values are still shown. Pull to refresh or retry."
                      : "Your analytics couldn't be loaded. Please try again."
                  }
                  primaryActionTitle="Retry"
                  onPrimaryAction={retry}
                />
              )}

              {/* Whole current review backlog, independent of the reporting selection */}
              {showUnanswered && (
                <InfoBanner
                  title={`${formatAnalyticsCount(unanswered)} ${unanswered === 1 ? "review needs" : "reviews need"} a reply`}
                  icon="comment-alert-outline"
                  actionTitle="View Reviews"
                  actionAccessibilityLabel="View merchant reviews"
                  onAction={() => router.navigate("/(merchant)/(tabs)/reviews")}
                >
                  <AppText className="text-sm leading-5 text-text-secondary">
                    Current published reviews across all dates.
                  </AppText>
                </InfoBanner>
              )}
            </View>
          )}

          {/* Selected-period activity; previous-period placeholders never populate KPI cards */}
          <MerchantContentSection
            title="Activity overview"
            description={`${
              report && !showPeriodLoading
                ? `${formatAnalyticsDate(report.meta.period.start_date)} – ${formatAnalyticsDate(report.meta.period.end_date)}`
                : `Last ${period} days`
            } · Asia/Manila`}
          >
            {showPeriodLoading ? (
              <AnalyticsSectionSkeleton section="activity" />
            ) : report ? (
              <View className="gap-4">
                <AnalyticsActivityOverview report={report} />
                <AnalyticsSourceNotice report={report} onRetry={retry} />
              </View>
            ) : null}
          </MerchantContentSection>

          <AnalyticsVisibilityTrends period={period} access={plusAccess} />

          {/* Current snapshots can remain visible while a new period loads */}
          <MerchantContentSection title="Your business now">
            {report ? (
              <AnalyticsCurrentSnapshot report={report} onRetry={retry} />
            ) : showPeriodLoading ? (
              <AnalyticsSectionSkeleton section="snapshot" />
            ) : null}
          </MerchantContentSection>

          {/* Current active specialty support */}
          <MerchantContentSection
            title="Specialty Support"
            description="What explorers vouch for most"
            accessory={
              plusAccess.allowed ? (
                <SafePressable
                  accessibilityRole="button"
                  accessibilityLabel="View Plus specialty trends"
                  onPress={() => openPlusDetail("specialties")}
                  className="min-h-12 justify-center py-2 active:opacity-70"
                >
                  <AppText weight="semibold" className="text-sm text-text-info">
                    View trends
                  </AppText>
                </SafePressable>
              ) : undefined
            }
          >
            {report ? (
              <View className="gap-3">
                <AnalyticsSpecialtySupport
                  report={report}
                  onRetry={retry}
                  specialtyTags={specialtyTags}
                />
                {profileError && (
                  <InfoBanner
                    title="Specialty styling unavailable"
                    actionTitle="Retry"
                    onAction={() => {
                      void refetchProfile();
                    }}
                  >
                    <AppText className="text-sm leading-5 text-text-secondary">
                      Your counts are available. Specialty icons and colors
                      could not refresh.
                    </AppText>
                  </InfoBanner>
                )}
              </View>
            ) : showPeriodLoading ? (
              <AnalyticsSectionSkeleton section="specialties" />
            ) : null}
          </MerchantContentSection>

          <AnalyticsMoreInsights access={plusAccess} onOpen={openPlusDetail} />

          {/* Generation time is not a guarantee of tracking freshness */}
          {report && (
            <AppText className="px-5 py-4 text-sm leading-5 text-text-secondary">
              Report generated{" "}
              {formatAnalyticsTimestamp(report.meta.generated_at)} · Manila
              time. This is the report time, not a guarantee of complete
              tracking.
            </AppText>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
