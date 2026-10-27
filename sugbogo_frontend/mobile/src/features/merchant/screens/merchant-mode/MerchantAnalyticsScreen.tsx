import AnalyticsSectionInformation from "../../components/analytics/AnalyticsSectionInformation";
import MerchantMetricCard from "../../components/MerchantMetricCard";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";
import AnalyticsPocketTrends, {
  AnalyticsPocketHeader,
} from "../../components/analytics/AnalyticsPocketTrends";
import { useMerchantPlusPocket } from "../../hooks/analytics/useMerchantPlusAnalytics";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { useIsFocused, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import NotificationBellButton from "@/features/notifications/components/NotificationBellButton";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";

import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";

import AnalyticsExport from "../../components/analytics/AnalyticsExport";
import AnalyticsReviewSummaryPreview from "../../components/analytics/AnalyticsReviewSummaryPreview";
import { useMerchantPlusStoredInsights } from "../../hooks/analytics/useMerchantAdvancedAnalytics";
import AnalyticsMoreInsights, {
  AnalyticsReportLinks,
} from "../../components/analytics/AnalyticsMoreInsights";
import AnalyticsOverviewSection from "../../components/analytics/AnalyticsOverviewSection";
import AnalyticsRoutePlanning from "../../components/analytics/AnalyticsRoutePlanning";
import AnalyticsSectionSkeleton from "../../components/analytics/AnalyticsSectionSkeleton";

import AnalyticsSpecialtySupport from "../../components/analytics/AnalyticsSpecialtySupport";

import AnalyticsVisibilityTrends from "../../components/analytics/AnalyticsVisibilityTrends";

import { merchantPlusReportScope } from "../../hooks/analytics/merchantPlusAnalyticsQueryKeys";
import { useAuthStore } from "@/features/auth/store/auth.store";

import useMerchantRoutePlanning from "../../hooks/analytics/useMerchantRoutePlanning";
import useMerchantStandardAnalytics from "../../hooks/analytics/useMerchantStandardAnalytics";

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

type PeriodSection = "visibility" | "routePlanning";

/** Displays detailed business reports with independent period controls and recovery. */
export default function MerchantAnalyticsScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const queryClient = useQueryClient();

  const bottomSpacing = useTabBarSpacing(24);

  // Bottom sheets
  const periodSheetRef = useRef<BottomSheetModal>(null);

  // Reporting state
  const reportPeriod: MerchantAnalyticsPeriod = "30";
  const [visibilityPeriod, setVisibilityPeriod] =
    useState<MerchantAnalyticsPeriod>("30");
  const [pocketPeriod, setPocketPeriod] =
    useState<MerchantAnalyticsPeriod>("30");
  const pocket = useMerchantPlusPocket({ period: pocketPeriod }, focused);
  const [routePlanningPeriod, setRoutePlanningPeriod] =
    useState<MerchantAnalyticsPeriod>("30");
  const [activePeriodSection, setActivePeriodSection] =
    useState<PeriodSection>("visibility");
  const [isRefreshingPlus, setIsRefreshingPlus] = useState(false);

  // Standard Analytics
  const { report, isLoading, isRefetching, error, refetch } =
    useMerchantStandardAnalytics(reportPeriod);

  // Independent analytics
  const reviewInsights = useMerchantPlusStoredInsights(focused);
  const routePlanning = useMerchantRoutePlanning(routePlanningPeriod, focused);

  // Account-scoped report refresh
  const accountId = useAuthStore((state) => state.user?.id);

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

  useQueryErrorNotification({
    error: focused ? pocket.error : null,
    toastId: "merchant-pocket-analytics-error",
    title: "Unable to load Pocket activity",
    fallbackMessage: "Please retry this section.",
  });
  // API error notifications
  useQueryErrorNotification({
    error: focused ? routePlanning.error : null,
    toastId: "merchant-route-planning-error",
    title: "Unable to load route-planning activity",
    fallbackMessage: "Please retry this section.",
  });

  useQueryErrorNotification({
    error: focused ? error : null,
    toastId: "merchant-standard-analytics-error",
    title: "Unable to load analytics",
    fallbackMessage: "Please try again.",
  });

  useQueryErrorNotification({
    error: focused ? reviewInsights.error : null,
    toastId: "merchant-review-summary-error",
    title: "Unable to load review summary",
    fallbackMessage: "Please retry this section.",
  });

  // One sheet edits only the section that opened it.
  const selectedSheetPeriod = {
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
    if (activePeriodSection === "visibility") {
      setVisibilityPeriod(value);
    } else {
      setRoutePlanningPeriod(value);
    }
  };

  const retry = () => {
    void refetch();
  };

  // Refresh active detailed reports.
  const refreshPlus = async () => {
    setIsRefreshingPlus(true);

    try {
      if (focused && accountId) {
        await queryClient.refetchQueries({
          queryKey: merchantPlusReportScope(accountId),
          type: "active",
          predicate: (query) =>
            query.queryKey[7] === undefined &&
            query.queryKey[2] !== "review-insights" &&
            query.queryKey[2] !== "pocket",
        });
      }
    } finally {
      setIsRefreshingPlus(false);
    }
  };

  // Refresh analytics without reloading the entire screen.
  const refresh = () => {
    void Promise.all([
      refetch(),
      refetchProfile(),
      reviewInsights.refetch(),
      routePlanning.refetch(),
      pocket.refetch(),
      refreshPlus(),
    ]);
  };

  // Existing detail-report navigation
  const openPlusDetail = (kind: PlusDetailKind) => {
    router.push({
      pathname: "/(merchant)/analytics/[report]",
      params: { report: kind, period: reportPeriod },
    });
  };

  const showPeriodLoading = isLoading || (!report && !error);
  const totalVouches =
    report?.sources.domain.availability === "unavailable"
      ? null
      : (report?.current_valid_vouches ?? null);

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
              pocket.isRefetching ||
              reviewInsights.isRefetching ||
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

          {/* Visibility trends */}
          <AnalyticsVisibilityTrends
            flushTop
            period={visibilityPeriod}
            onOpenPeriod={() => openPeriodSheet("visibility")}
          >
            <AnalyticsReportLinks
              group="visibility"
              onOpen={(kind) =>
                router.push({
                  pathname: "/(merchant)/analytics/[report]",
                  params: { report: kind, period: visibilityPeriod },
                })
              }
              onOpenDiscoverySources={() =>
                router.push({
                  pathname: "/(merchant)/analytics/discovery-sources",
                  params: { period: visibilityPeriod },
                })
              }
            />
          </AnalyticsVisibilityTrends>

          {/* Pocket activity keeps independent period controls and recovery. */}
          <View className="mt-2 gap-4 bg-surface px-5 pb-5 pt-4">
            <AnalyticsPocketHeader
              title="Pocket trends"
              period={pocketPeriod}
              onPeriodChange={setPocketPeriod}
              report={pocket.data}
            />
            {(!!pocket.error ||
              pocket.data?.meta.availability === "unavailable") && (
              <ErrorState
                size="section"
                title={
                  pocket.data
                    ? "Unable to refresh Pocket activity"
                    : "Pocket activity unavailable"
                }
                description={
                  pocket.data
                    ? "Available measurements are still shown."
                    : "Please try this section again."
                }
                primaryActionTitle="Retry"
                onPrimaryAction={() => void pocket.refetch()}
              />
            )}
            {(pocket.isPending ||
              (pocket.data &&
                pocket.data.meta.availability !== "unavailable")) && (
              <AnalyticsPocketTrends
                report={pocket.data}
                loading={pocket.isPending}
                retry={() => void pocket.refetch()}
              />
            )}
          </View>

          {/* Current specialty support */}
          <AnalyticsOverviewSection
            title="Specialty vouches"
            description="Current valid vouches by specialty"
            accessory={<AnalyticsSectionInformation section="specialties" />}
          >
            <View className="mb-4">
              <MerchantMetricCard
                icon="heart-outline"
                label="Total vouches"
                value={formatAnalyticsCount(totalVouches)}
                detail="Current valid vouches across your specialties"
                unavailable={totalVouches === null}
                loading={showPeriodLoading}
                stacked
              />
            </View>
            {report ? (
              <View className="gap-3">
                <AnalyticsSpecialtySupport
                  report={report}
                  onRetry={retry}
                  specialtyTags={specialtyTags}
                />

                {profileError ? (
                  <ErrorState
                    variant="analytics"
                    title="Specialty icons and colors unavailable"
                    description="Counts are still available. Specialty icons and colors could not refresh."
                    primaryActionTitle="Retry"
                    onPrimaryAction={() => void refetchProfile()}
                  />
                ) : null}
              </View>
            ) : showPeriodLoading ? (
              <AnalyticsSectionSkeleton section="specialties" />
            ) : null}
            <View className="mt-4 border-t border-border-primary/60">
              <AnalyticsReportLinks
                group="specialties"
                onOpen={openPlusDetail}
              />
            </View>
          </AnalyticsOverviewSection>

          <AnalyticsReviewSummaryPreview
            report={reviewInsights.data}
            loading={reviewInsights.isPending}
            error={reviewInsights.error}
            onRetry={() => void reviewInsights.refetch()}
            onOpen={() => openPlusDetail("review-insights")}
          >
            <AnalyticsReportLinks group="reviews" onOpen={openPlusDetail} />
          </AnalyticsReviewSummaryPreview>

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

          {__DEV__ && (
            <View className="bg-surface px-5 py-3">
              <SafePressable
                accessibilityRole="button"
                accessibilityLabel="Open Analytics development preview"
                onPress={() =>
                  router.push("/(merchant)/analytics/development-preview")
                }
                className="min-h-11 cursor-pointer justify-center"
              >
                <AppText className="text-sm text-brand">
                  Open Analytics development preview
                </AppText>
              </SafePressable>
            </View>
          )}
          {/* Additional analytics detail reports */}
          <AnalyticsMoreInsights onOpen={openPlusDetail} />
          <View className="mt-2 bg-surface px-5 py-4">
            <AnalyticsExport enabled={focused} />
          </View>
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
    </SafeAreaView>
  );
}
