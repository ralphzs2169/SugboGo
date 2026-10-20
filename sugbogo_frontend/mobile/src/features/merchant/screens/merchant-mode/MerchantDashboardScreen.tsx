import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { useIsFocused, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import NotificationBellButton from "@/features/notifications/components/NotificationBellButton";

import ErrorState from "@/shared/components/ErrorState";

import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";

import AnalyticsActivityOverview from "../../components/analytics/AnalyticsActivityOverview";
import AnalyticsHeaderControls from "../../components/analytics/AnalyticsHeaderControls";
import AnalyticsMeasurementSheet from "../../components/analytics/AnalyitcsMeasurementSheet";

import AnalyticsOverviewSection from "../../components/analytics/AnalyticsOverviewSection";

import AnalyticsSectionSkeleton from "../../components/analytics/AnalyticsSectionSkeleton";
import AnalyticsSourceNotice from "../../components/analytics/AnalyticsSourceNotice";

import AnalyticsUnansweredReviews from "../../components/analytics/AnalyticsUnansweredReviews";
import MerchantListingSuggestion from "../../components/business-profile/MerchantListingSuggestion";
import MerchantRecentActivity from "../../components/dashboard/MerchantRecentActivity";
import useMerchantRecentActivity from "../../hooks/dashboard/useMerchantRecentActivity";

import { merchantPlusReportScope } from "../../hooks/analytics/merchantPlusAnalyticsQueryKeys";
import useMerchantPlusAccess from "../../hooks/analytics/useMerchantPlusAccess";
import {
  useMerchantPlusPocket,
  useMerchantPlusReviews,
  useMerchantPlusSpecialties,
  useMerchantPlusVisibility,
} from "../../hooks/analytics/useMerchantPlusAnalytics";

import useMerchantStandardAnalytics from "../../hooks/analytics/useMerchantStandardAnalytics";
import useMerchantUnansweredReviews from "../../hooks/analytics/useMerchantUnansweredReviews";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";

import MerchantScreenHeader from "../../layout/MerchantScreenHeader";

import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";

import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";

const PERIOD_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

/** Combines the business overview, review tasks, recent explorer activity, and listing tips. */
export default function MerchantDashboardScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const queryClient = useQueryClient();

  const bottomSpacing = useTabBarSpacing(24);

  // Bottom sheets
  const measurementSheetRef = useRef<BottomSheetModal>(null);
  const periodSheetRef = useRef<BottomSheetModal>(null);

  // Reporting state
  const [overviewPeriod, setOverviewPeriod] =
    useState<MerchantAnalyticsPeriod>("30");
  const [isRefreshingPlus, setIsRefreshingPlus] = useState(false);

  // Standard Analytics
  const { report, isLoading, isRefetching, error, refetch } =
    useMerchantStandardAnalytics(overviewPeriod);

  // Current dashboard snapshots
  const unanswered = useMerchantUnansweredReviews(focused);
  const recentActivity = useMerchantRecentActivity(focused);

  // Existing entitlement and comparison support
  const plusAccess = useMerchantPlusAccess();

  const [validatedSnapshot, setValidatedSnapshot] = useState<string | null>(
    null,
  );

  const snapshotKey = `${plusAccess.accountId}:${overviewPeriod}:${report?.meta.generated_at}`;

  // Revalidate the reporting cutoff when the screen regains focus.
  useEffect(() => {
    if (!focused || !plusAccess.accountId) return;

    let active = true;

    void refetch({ cancelRefetch: false }).then((result) => {
      if (active && !result.error && result.data) {
        setValidatedSnapshot(
          `${plusAccess.accountId}:${overviewPeriod}:${result.data.meta.generated_at}`,
        );
      }
    });

    return () => {
      active = false;
      setValidatedSnapshot(null);
    };
  }, [focused, overviewPeriod, plusAccess.accountId, refetch]);

  // Backend-aligned comparisons
  const comparisonSelection = {
    period: overviewPeriod,
    as_of: report?.meta.generated_at,
  };

  const canReadComparisons =
    focused &&
    plusAccess.allowed &&
    !isLoading &&
    !isRefetching &&
    !error &&
    !!report &&
    validatedSnapshot === snapshotKey;

  const visibilityInterval = overviewPeriod === "90" ? "weekly" : "daily";

  const observedVisibility = useMerchantPlusVisibility(
    { period: overviewPeriod },
    visibilityInterval,
    focused &&
      plusAccess.allowed &&
      !!report &&
      report.sources.visibility.availability !== "unavailable",
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
    canReadComparisons && report?.sources.domain.availability !== "unavailable",
  );

  const vouchComparison = useMerchantPlusSpecialties(
    comparisonSelection,
    canReadComparisons && report?.sources.domain.availability !== "unavailable",
  );

  // Business identity for the shared header
  const {
    business,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useMerchantBusinessProfile();

  // API error notifications
  useQueryErrorNotification({
    error: focused ? recentActivity.error : null,
    toastId: "merchant-recent-activity-error",
    title: "Unable to load recent activity",
    fallbackMessage: "Your other dashboard sections are still available.",
  });

  useQueryErrorNotification({
    error: focused ? unanswered.error : null,
    toastId: "merchant-unanswered-reviews-error",
    title: "Unable to load reviews needing replies",
    fallbackMessage: "Please try again.",
  });

  useQueryErrorNotification({
    error: focused ? error : null,
    toastId: "merchant-dashboard-overview-error",
    title: "Unable to load analytics",
    fallbackMessage: "Please try again.",
  });

  useQueryErrorNotification({
    error: focused ? plusAccess.error : null,
    toastId: "merchant-plus-access-error",
    title: "Unable to check report access",
    fallbackMessage: "Your Standard analytics remain available.",
  });

  useQueryErrorNotification({
    error: canReadComparisons ? replyComparison.error : null,
    toastId: "merchant-reply-comparison-error",
    title: "Unable to load reply comparison",
    fallbackMessage: "Your Standard review counts remain available.",
  });

  useQueryErrorNotification({
    error: canReadComparisons ? pocketComparison.error : null,
    toastId: "merchant-save-comparison-error",
    title: "Unable to load save comparison",
    fallbackMessage: "Your Standard metrics remain available.",
  });

  useQueryErrorNotification({
    error: canReadComparisons ? vouchComparison.error : null,
    toastId: "merchant-vouch-comparison-error",
    title: "Unable to load vouch comparison",
    fallbackMessage: "Your selected-period vouch count remains available.",
  });

  // Retry the Standard report and validate its comparison cutoff.
  const retry = () => {
    void refetch().then((result) => {
      if (!result.error && result.data) {
        setValidatedSnapshot(
          `${plusAccess.accountId}:${overviewPeriod}:${result.data.meta.generated_at}`,
        );
      }
    });
  };

  // Refresh existing comparison queries.
  const refreshPlus = async () => {
    setIsRefreshingPlus(true);

    try {
      const access = await plusAccess.refetch();

      if (!access.error && access.data?.has_plus_access) {
        await queryClient.refetchQueries({
          queryKey: merchantPlusReportScope(plusAccess.accountId),
          type: "active",
          predicate: (query) =>
            query.queryKey[7] === undefined &&
            query.queryKey[2] !== "review-insights",
        });
      }
    } finally {
      setIsRefreshingPlus(false);
    }
  };

  // Refresh each dashboard source independently.
  const refresh = () => {
    setValidatedSnapshot(null);

    void Promise.all([
      refetch().then((result) => {
        if (!result.error && result.data) {
          setValidatedSnapshot(
            `${plusAccess.accountId}:${overviewPeriod}:${result.data.meta.generated_at}`,
          );
        }
      }),
      refetchProfile(),
      unanswered.refetch(),
      recentActivity.refetch(),
      refreshPlus(),
    ]);
  };

  const showPeriodLoading = isLoading || (!report && !error);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      {/* Fixed merchant screen header */}
      <MerchantScreenHeader
        title="Dashboard"
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

      {/* Current tasks and business overview */}
      <ScrollView
        testID="merchant-dashboard-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomSpacing }}
        refreshControl={
          <RefreshControl
            refreshing={
              isRefetching ||
              isRefreshingPlus ||
              unanswered.isRefetching ||
              recentActivity.isRefetching
            }
            onRefresh={refresh}
            tintColor={theme.extends.colors.brand}
            colors={[theme.extends.colors.brand]}
          />
        }
      >
        <View className="bg-background">
          {/* Standard Analytics request recovery */}
          {error ? (
            <View className="bg-surface px-5 pb-4 pt-3">
              <ErrorState
                variant="analytics"
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
          ) : null}

          {/* Business overview */}
          <AnalyticsOverviewSection
            title="Business overview"
            flushTop
            description="Your business activity at a glance."
            accessory={
              <AnalyticsHeaderControls
                period={overviewPeriod}
                onOpenPeriod={() => periodSheetRef.current?.present()}
                onOpenInformation={() => measurementSheetRef.current?.present()}
                informationLabel="How analytics are measured"
                informationHint="Opens explanations about your business analytics"
              />
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
                  plusSpecialties={
                    canReadComparisons && !vouchComparison.error
                      ? vouchComparison.data
                      : null
                  }
                />

                <AnalyticsSourceNotice report={report} onRetry={retry} />
              </View>
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
          {/* Current timeline stays independent of reporting periods and inbox read state. */}
          <MerchantRecentActivity
            data={recentActivity.data}
            specialtyTags={
              business?.id === recentActivity.data?.business.id
                ? business?.specialty_tags
                : undefined
            }
            loading={recentActivity.isPending}
            refreshing={recentActivity.isFetching}
            error={recentActivity.error}
            onRetry={() => {
              void recentActivity.refetch();
            }}
            onReview={(reviewId) =>
              router.navigate({
                pathname: "/(merchant)/(tabs)/reviews",
                params: {
                  reviewId: String(reviewId),
                  filter: "all",
                  ordering: "newest",
                  reviewIntent: String(Date.now()),
                },
              })
            }
          />

          {/* Optional improvement; required onboarding fields are excluded */}
          {business &&
          !isProfileLoading &&
          !profileError &&
          business.status === "active" ? (
            <MerchantListingSuggestion
              key={business.id}
              business={business}
              onAddPhotos={() => router.push("/(merchant)/business-photos")}
              onEditInformation={() =>
                router.push("/(merchant)/business-information")
              }
              onAddLandmarks={() => router.push("/(merchant)/location-change")}
            />
          ) : null}
        </View>
      </ScrollView>

      {/* Reusable reporting-period selection sheet */}
      <SelectionBottomSheet
        sheetRef={periodSheetRef}
        title="Reporting period"
        description="Choose a time range for this section."
        options={PERIOD_OPTIONS}
        selectedValue={overviewPeriod}
        onSelect={(value) => {
          if (value !== "7" && value !== "30" && value !== "90") {
            return;
          }
          if (value !== overviewPeriod) {
            setValidatedSnapshot(null);
            setOverviewPeriod(value);
          }
        }}
        snapPoints={["50%"]}
      />

      {/* Business overview measurement information */}
      <AnalyticsMeasurementSheet
        sheetRef={measurementSheetRef}
        report={showPeriodLoading ? null : report}
      />
    </SafeAreaView>
  );
}
