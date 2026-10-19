import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { useIsFocused, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import AnalyticsHeaderControls from "../../components/analytics/AnalyticsHeaderControls";
import AnalyticsMeasurementSheet from "../../components/analytics/AnalyitcsMeasurementSheet";
import AnalyticsMoreInsights from "../../components/analytics/AnalyticsMoreInsights";
import AnalyticsOverviewSection from "../../components/analytics/AnalyticsOverviewSection";
import AnalyticsRoutePlanning from "../../components/analytics/AnalyticsRoutePlanning";
import AnalyticsSectionSkeleton from "../../components/analytics/AnalyticsSectionSkeleton";
import AnalyticsSourceNotice from "../../components/analytics/AnalyticsSourceNotice";
import AnalyticsSpecialtySupport from "../../components/analytics/AnalyticsSpecialtySupport";
import AnalyticsUnansweredReviews from "../../components/analytics/AnalyticsUnansweredReviews";
import AnalyticsVisibilityTrends from "../../components/analytics/AnalyticsVisibilityTrends";

import { merchantPlusReportScope } from "../../hooks/analytics/merchantPlusAnalyticsQueryKeys";
import useMerchantPlusAccess from "../../hooks/analytics/useMerchantPlusAccess";
import {
  useMerchantPlusPocket,
  useMerchantPlusReviews,
  useMerchantPlusVisibility,
} from "../../hooks/analytics/useMerchantPlusAnalytics";
import useMerchantRoutePlanning from "../../hooks/analytics/useMerchantRoutePlanning";
import useMerchantStandardAnalytics from "../../hooks/analytics/useMerchantStandardAnalytics";
import useMerchantUnansweredReviews from "../../hooks/analytics/useMerchantUnansweredReviews";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";

import MerchantScreenHeader from "../../layout/MerchantScreenHeader";

import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import type { PlusDetailKind } from "../../types/merchantPlusAnalytics.types";

import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";

const PERIOD_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

type PeriodSection = "overview" | "visibility" | "routePlanning";

/**
 * Displays merchant analytics with compact reporting-period
 * selection and independent recovery for each report section.
 *
 * Preserves backend-aligned comparisons, current-state metrics,
 * refresh behavior, and detailed measurement explanations.
 */
export default function MerchantAnalyticsScreen() {
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
  const [visibilityPeriod, setVisibilityPeriod] =
    useState<MerchantAnalyticsPeriod>("30");
  const [routePlanningPeriod, setRoutePlanningPeriod] =
    useState<MerchantAnalyticsPeriod>("30");
  const [activePeriodSection, setActivePeriodSection] =
    useState<PeriodSection>("overview");
  const [isRefreshingPlus, setIsRefreshingPlus] = useState(false);

  // Standard Analytics
  const { report, isLoading, isRefetching, error, refetch } =
    useMerchantStandardAnalytics(overviewPeriod);

  // Independent analytics
  const unanswered = useMerchantUnansweredReviews(focused);
  const routePlanning = useMerchantRoutePlanning(routePlanningPeriod, focused);

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
    canReadComparisons && report?.sources.domain.availability !== "unavailable",
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

  // One sheet edits only the section that opened it.
  const selectedSheetPeriod = {
    overview: overviewPeriod,
    visibility: visibilityPeriod,
    routePlanning: routePlanningPeriod,
  }[activePeriodSection];

  const openPeriodSheet = (section: PeriodSection) => {
    setActivePeriodSection(section);
    periodSheetRef.current?.present();
  };

  const handlePeriodSelect = (value: string) => {
    if (value !== "7" && value !== "30" && value !== "90") return;

    // SelectionBottomSheet dismisses itself; never dismiss unopened info modals.
    if (activePeriodSection === "overview") {
      if (value === overviewPeriod) return;
      setValidatedSnapshot(null);
      setOverviewPeriod(value);
    } else if (activePeriodSection === "visibility") {
      setVisibilityPeriod(value);
    } else {
      setRoutePlanningPeriod(value);
    }
  };

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
          predicate: (query) => query.queryKey[7] === undefined,
        });
      }
    } finally {
      setIsRefreshingPlus(false);
    }
  };

  // Refresh analytics without reloading the entire screen.
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
      routePlanning.refetch(),
      refreshPlus(),
    ]);
  };

  // Existing detail-report navigation
  const openPlusDetail = (kind: PlusDetailKind) => {
    if (!plusAccess.allowed) return;

    router.push({
      pathname: "/(merchant)/analytics/[report]",
      params: { report: kind, period: overviewPeriod },
    });
  };

  const showPeriodLoading = isLoading || (!report && !error);

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
          {/* Standard Analytics request recovery */}
          {error ? (
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
          ) : null}

          {/* Business overview */}
          <AnalyticsOverviewSection
            title="Business overview"
            description="Your business activity at a glance."
            accessory={
              <AnalyticsHeaderControls
                period={overviewPeriod}
                onOpenPeriod={() => openPeriodSheet("overview")}
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

          {/* Current specialty support */}
          <AnalyticsOverviewSection
            title="Specialty vouches"
            description="Current valid vouches by specialty"
            accessory={
              plusAccess.allowed ? (
                <SafePressable
                  accessibilityRole="button"
                  accessibilityLabel="View specialty trends"
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

                {profileError ? (
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
                ) : null}
              </View>
            ) : showPeriodLoading ? (
              <AnalyticsSectionSkeleton section="specialties" />
            ) : null}
          </AnalyticsOverviewSection>

          {/* Visibility trends */}
          <AnalyticsVisibilityTrends
            period={visibilityPeriod}
            onOpenPeriod={() => openPeriodSheet("visibility")}
          />

          {/* Recorded route-planning activity */}
          <AnalyticsRoutePlanning
            period={routePlanningPeriod}
            onOpenPeriod={() => openPeriodSheet("routePlanning")}
            data={routePlanning.data}
            loading={routePlanning.isPending}
            error={routePlanning.error}
            onRetry={() => {
              void routePlanning.refetch();
            }}
          />

          {/* Additional analytics detail reports */}
          <AnalyticsMoreInsights
            hasPlusAccess={plusAccess.allowed}
            onOpen={openPlusDetail}
            onOpenDiscoverySources={() =>
              router.push({
                pathname: "/(merchant)/analytics/discovery-sources",
                params: { period: overviewPeriod },
              })
            }
          />
        </View>
      </ScrollView>

      {/* Reusable reporting-period selection sheet */}
      <SelectionBottomSheet
        sheetRef={periodSheetRef}
        title="Reporting period"
        description="Choose a time range for this section."
        options={PERIOD_OPTIONS}
        selectedValue={selectedSheetPeriod}
        onSelect={handlePeriodSelect}
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
