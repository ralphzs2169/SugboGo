import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { useIsFocused, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import NotificationBellButton from "@/features/notifications/components/NotificationBellButton";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import InfoBanner from "@/shared/components/InfoBanner";
import SafePressable from "@/shared/components/SafePressable";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";

import AnalyticsActivityOverview from "../../components/analytics/AnalyticsActivityOverview";

import AnalyticsMoreInsights from "../../components/analytics/AnalyticsMoreInsights";
import AnalyticsOverviewSection from "../../components/analytics/AnalyticsOverviewSection";
import AnalyticsPeriodSelector from "../../components/analytics/AnalyticsPeriodSelector";
import AnalyticsSectionSkeleton from "../../components/analytics/AnalyticsSectionSkeleton";
import AnalyticsSourceNotice from "../../components/analytics/AnalyticsSourceNotice";
import AnalyticsSpecialtySupport from "../../components/analytics/AnalyticsSpecialtySupport";
import AnalyticsVisibilityTrends from "../../components/analytics/AnalyticsVisibilityTrends";
import AnalyticsUnansweredReviews from "../../components/analytics/AnalyticsUnansweredReviews";
import AnalyticsRoutePlanning from "../../components/analytics/AnalyticsRoutePlanning";
import useMerchantRoutePlanning from "../../hooks/analytics/useMerchantRoutePlanning";
import useMerchantUnansweredReviews from "../../hooks/analytics/useMerchantUnansweredReviews";

import useMerchantPlusAccess from "../../hooks/analytics/useMerchantPlusAccess";
import {
  useMerchantPlusPocket,
  useMerchantPlusReviews,
  useMerchantPlusVisibility,
} from "../../hooks/analytics/useMerchantPlusAnalytics";
import { merchantPlusReportScope } from "../../hooks/analytics/merchantPlusAnalyticsQueryKeys";
import useMerchantStandardAnalytics from "../../hooks/analytics/useMerchantStandardAnalytics";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";

import MerchantScreenHeader from "../../layout/MerchantScreenHeader";

import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import type { PlusDetailKind } from "../../types/merchantPlusAnalytics.types";
import {
  formatAnalyticsDate,
  formatAnalyticsTimestamp,
} from "../../utils/merchantAnalytics.utils";
import AnalyticsMeasurementSheet from "../../components/analytics/AnalyitcsMeasurementSheet";

/**
 * Displays merchant business analytics with selectable reporting periods.
 *
 * Keeps Standard metrics independent of optional Plus comparisons,
 * provides localized recovery, and presents measurement explanations
 * through the existing bottom-sheet interaction pattern.
 */
export default function MerchantAnalyticsScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const unanswered = useMerchantUnansweredReviews(focused);
  const queryClient = useQueryClient();

  const bottomSpacing = useTabBarSpacing(24);
  const measurementSheetRef = useRef<BottomSheetModal>(null);

  const [period, setPeriod] = useState<MerchantAnalyticsPeriod>("30");
  const routePlanning = useMerchantRoutePlanning(period, focused);
  const [isRefreshingPlus, setIsRefreshingPlus] = useState(false);

  // Standard Analytics
  const { report, isLoading, isRefetching, error, refetch } =
    useMerchantStandardAnalytics(period);

  // Plus entitlement
  const plusAccess = useMerchantPlusAccess();

  // Backend-aligned Plus comparisons
  const comparisonSelection = {
    period,
    as_of: report?.meta.generated_at,
  };

  const canReadComparisons =
    focused && plusAccess.allowed && !isLoading && !error && !!report;

  const visibilityInterval = period === "90" ? "weekly" : "daily";

  const observedVisibility = useMerchantPlusVisibility(
    { period },
    visibilityInterval,
    false,
  );

  const visibilityComparison = useMerchantPlusVisibility(
    comparisonSelection,
    visibilityInterval,
    canReadComparisons &&
      observedVisibility.data?.metrics.profile_visits.comparison_eligibility
        ?.eligible === true,
  );

  const pocketComparison = useMerchantPlusPocket(
    comparisonSelection,
    canReadComparisons &&
      report?.sources.visibility.availability !== "unavailable",
  );

  const replyComparison = useMerchantPlusReviews(
    comparisonSelection,
    focused &&
      plusAccess.allowed &&
      !isLoading &&
      !error &&
      !!report &&
      report.sources.domain.availability !== "unavailable",
  );

  // Merchant business profile and specialty styling
  const {
    business,
    error: profileError,
    refetch: refetchProfile,
  } = useMerchantBusinessProfile();

  const specialtyTags =
    business?.id === report?.business.id
      ? (business?.specialty_tags ?? [])
      : [];

  // API error notifications
  useQueryErrorNotification({
    error: focused ? routePlanning.error : null,
    toastId: "merchant-route-planning-error",
    title: "Unable to load route-planning activity",
    fallbackMessage: "Please retry this section.",
  });
  useQueryErrorNotification({
    error: focused ? unanswered.error : null,
    toastId: "merchant-unanswered-reviews-error",
    title: "Unable to load reviews needing replies",
    fallbackMessage: "Please try again.",
  });
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

  useQueryErrorNotification({
    error: focused && plusAccess.allowed ? replyComparison.error : null,
    toastId: "merchant-reply-comparison-error",
    title: "Unable to load reply comparison",
    fallbackMessage: "Your Standard review counts remain available.",
  });

  useQueryErrorNotification({
    error: focused && plusAccess.allowed ? pocketComparison.error : null,
    toastId: "merchant-save-comparison-error",
    title: "Unable to load save comparison",
    fallbackMessage: "Your Standard metrics remain available.",
  });

  // Reporting controls
  const handlePeriodChange = (nextPeriod: MerchantAnalyticsPeriod) => {
    measurementSheetRef.current?.dismiss();
    setPeriod(nextPeriod);
  };

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
    void Promise.all([
      refetch(),
      refetchProfile(),
      unanswered.refetch(),
      routePlanning.refetch(),
      refreshPlus(),
    ]);
  };

  const openPlusDetail = (kind: PlusDetailKind) => {
    if (!plusAccess.allowed) return;

    router.push({
      pathname: "/(merchant)/analytics/[report]",
      params: { report: kind, period },
    });
  };

  const showPeriodLoading = isLoading || (!report && !error);

  const showReportDates =
    !!report && !showPeriodLoading && !isRefetching && !error;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      {/* Fixed merchant screen header */}
      <MerchantScreenHeader
        title="Analytics"
        subtitle={report?.business.name}
        leadingIcon="storefront-outline"
        coverPhotoUrl={
          business?.id === report?.business.id
            ? business?.display_cover_photo_url
            : null
        }
        compact
        rightAccessory={<NotificationBellButton />}
      />

      {/* Scrollable analytics content */}
      <ScrollView
        testID="merchant-analytics-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomSpacing }}
        refreshControl={
          <RefreshControl
            refreshing={
              isRefetching ||
              isRefreshingPlus ||
              unanswered.isRefetching ||
              routePlanning.isRefetching
            }
            onRefresh={refresh}
            tintColor={theme.extends.colors.brand}
            colors={[theme.extends.colors.brand]}
          />
        }
      >
        <View className="bg-background">
          {/* Reporting period controls */}
          <View className="gap-2 bg-surface px-5 pb-4 pt-3">
            <AppText weight="semibold" className="text-sm text-text-primary">
              Reporting period
            </AppText>

            <AnalyticsPeriodSelector
              period={period}
              onChange={handlePeriodChange}
              overview
            />

            <View className="flex-row flex-wrap items-center gap-1.5">
              <MaterialCommunityIcons
                name="calendar-outline"
                size={15}
                color={theme.extends.colors.text.secondary}
                accessible={false}
              />

              <AppText className="text-xs leading-5 text-text-secondary">
                {showReportDates && report
                  ? `${formatAnalyticsDate(report.meta.period.start_date)} – ${formatAnalyticsDate(report.meta.period.end_date)}`
                  : `Last ${period} days`}{" "}
                · Manila time
              </AppText>
            </View>
          </View>

          {/* Standard Analytics request recovery */}
          {error && (
            <View className="bg-surface px-5 pb-4 pt-3">
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
            </View>
          )}

          {/* Business overview and measurement information */}
          <AnalyticsOverviewSection
            title="Business overview"

            accessory={
              report && !showPeriodLoading ? (
                <SafePressable
                  onPress={() => measurementSheetRef.current?.present()}
                  accessibilityRole="button"
                  accessibilityLabel="How analytics are measured"
                  accessibilityHint="Opens explanations about your business analytics"
                  className="h-11 w-11 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
                >
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={22}
                    color={theme.extends.colors.text.secondary}
                    accessible={false}
                  />
                </SafePressable>
              ) : undefined
            }
          >
            {showPeriodLoading ? (
              <AnalyticsSectionSkeleton section="activity" />
            ) : report ? (
              <View className="gap-4">
                <AnalyticsActivityOverview
                  report={report}
                  plusReviews={plusAccess.allowed ? replyComparison.data : null}
                  plusVisibility={
                    plusAccess.allowed ? visibilityComparison.data : null
                  }
                  plusPocket={plusAccess.allowed ? pocketComparison.data : null}
                />

                <AnalyticsSourceNotice report={report} onRetry={retry} />
              </View>
            ) : null}
          </AnalyticsOverviewSection>

          {/* Current specialty support */}
          <AnalyticsOverviewSection
            title="Specialty Support"
            description="Current support · All dates"
            accessory={
              plusAccess.allowed ? (
                <SafePressable
                  accessibilityRole="button"
                  accessibilityLabel="View Plus specialty trends"
                  onPress={() => openPlusDetail("specialties")}
                  className="min-h-12 flex-row cursor-pointer items-center justify-center gap-1 active:opacity-70"
                >
                  <AppText weight="semibold" className="text-sm text-brand">
                    View trends
                  </AppText>

                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={theme.extends.colors.brand}
                    accessible={false}
                  />
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
                    title="Specialty icons and colors unavailable"
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
          </AnalyticsOverviewSection>

          {/* Current actionable review backlog */}
          <AnalyticsUnansweredReviews
            data={unanswered.data}
            loading={unanswered.isPending}
            error={unanswered.error}
            onRetry={() => {
              void unanswered.refetch();
            }}
            onReview={() =>
              router.navigate({
                pathname: "/(merchant)/(tabs)/reviews",
                params: {
                  filter: "needs-reply",
                  ordering: "oldest",
                  reviewIntent: String(Date.now()),
                },
              })
            }
          />
          {/* Plus visibility trends */}
          <AnalyticsVisibilityTrends period={period} />

          {/* Recorded guidance intent is Standard and independent of other reports. */}
          <AnalyticsRoutePlanning
            data={routePlanning.data}
            loading={routePlanning.isPending}
            error={routePlanning.error}
            onRetry={() => {
              void routePlanning.refetch();
            }}
          />

          {/* Additional analytics reports */}
          <AnalyticsMoreInsights onOpen={openPlusDetail} />

          {/* Report preparation timestamp */}
          {report && (
            <AppText className="px-5 py-4 text-xs leading-5 text-text-secondary">
              Report prepared{" "}
              {formatAnalyticsTimestamp(report.meta.generated_at)} · Manila
              time.
            </AppText>
          )}
        </View>
      </ScrollView>

      {/* Measurement explanation sheet, independent of report scrolling */}
      {report && (
        <AnalyticsMeasurementSheet
          sheetRef={measurementSheetRef}
          report={report}
        />
      )}
    </SafeAreaView>
  );
}
