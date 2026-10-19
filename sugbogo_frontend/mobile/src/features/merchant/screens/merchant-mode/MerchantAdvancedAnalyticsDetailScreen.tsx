import { useIsFocused } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import AnalyticsDetailHeader, {
  ANALYTICS_DETAIL_DESCRIPTIONS,
} from "../../components/analytics/AnalyticsDetailHeader";
import AnalyticsChartEmptyState from "../../components/analytics/AnalyticsChartEmptyState";
import AnalyticsPeerComparisons from "../../components/analytics/AnalyticsPeerComparisons";
import AnalyticsStoredReviewInsights from "../../components/analytics/AnalyticsStoredReviewInsights";
import AnalyticsProfileVisitTiming from "../../components/analytics/AnalyticsProfileVisitTiming";
import AnalyticsBusinessRecommendations from "../../components/analytics/AnalyticsBusinessRecommendations";
import {
  PlusAccessGate,
  PlusRequestState,
} from "../../components/analytics/AnalyticsPlusStates";
import useMerchantPlusAccess from "../../hooks/analytics/useMerchantPlusAccess";
import {
  useMerchantPlusPeers,
  useMerchantPlusStoredInsights,
  useMerchantPlusTiming,
  useMerchantPlusRecommendations,
} from "../../hooks/analytics/useMerchantAdvancedAnalytics";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import type { AdvancedPlusDetailKind } from "../../types/merchantPlusAnalytics.types";

/** Lazily loads one advanced report and keeps generation separate from all read/refresh actions. */
export default function MerchantAdvancedAnalyticsDetailScreen({
  kind,
  initialPeriod,
  title,
}: {
  kind: AdvancedPlusDetailKind;
  initialPeriod: MerchantAnalyticsPeriod;
  title: string;
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const [refreshing, setRefreshing] = useState(false);
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const access = useMerchantPlusAccess();
  const enabled = access.allowed && focused;
  const selection = { period };
  const peers = useMerchantPlusPeers(selection, enabled && kind === "peers");
  const insights = useMerchantPlusStoredInsights(
    enabled && kind === "review-insights",
  );
  const timing = useMerchantPlusTiming(selection, enabled && kind === "timing");
  const recommendations = useMerchantPlusRecommendations(
    selection,
    enabled && kind === "recommendations",
  );
  const query =
    kind === "peers"
      ? peers
      : kind === "review-insights"
        ? insights
        : kind === "timing"
          ? timing
          : recommendations;
  const retry = () => {
    void query.refetch();
  };
  useQueryErrorNotification({
    error: focused ? access.error : null,
    toastId: "advanced-plus-access",
    title: "Unable to check Plus access",
    fallbackMessage: "Please retry the access check.",
  });
  useQueryErrorNotification({
    error: focused ? query.error : null,
    toastId: `advanced-plus-${kind}`,
    title: "Unable to load analytics",
    fallbackMessage: "Please retry this report.",
  });
  useQueryErrorNotification({
    error:
      focused && enabled && kind === "recommendations"
        ? recommendations.refreshError
        : null,
    toastId: "plus-recommendation-refresh",
    title: "Unable to refresh recommendations",
    fallbackMessage: "Please check status before requesting again.",
  });

  const refresh = async () => {
    setRefreshing(true);
    try {
      const status = await access.refetch();
      if (!status.error && status.data?.has_plus_access) await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-background">
      {/* Stored insights retain their own dates, with no dashboard date selector. */}
      <ScrollView
        testID="advanced-plus-detail-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={theme.extends.colors.brand}
            colors={[theme.extends.colors.brand]}
          />
        }
      >
        <AnalyticsDetailHeader
          title={title}
          description={ANALYTICS_DETAIL_DESCRIPTIONS[kind]}
          period={kind === "review-insights" ? undefined : period}
          onPeriodChange={setPeriod}
        />
        <View className="mt-2 bg-surface px-5 py-5">
          <PlusAccessGate access={access}>
            <PlusRequestState
              error={query.error}
              hasData={!!query.data}
              loading={query.isPending}
              retry={retry}
            >
              {/* Each report preserves usable partial data, with recovery localized to this query. */}
              {query.data?.meta.availability === "unavailable" &&
              kind !== "timing" &&
              kind !== "recommendations" ? (
                <AnalyticsChartEmptyState
                  title="Report data unavailable"
                  description="This report could not be loaded. Unavailable counts do not mean zero activity."
                  icon="cloud-off-outline"
                  onRetry={retry}
                />
              ) : (
                <>
                  {kind === "peers" && peers.data && (
                    <AnalyticsPeerComparisons
                      report={peers.data}
                      retry={() => void peers.refetch()}
                    />
                  )}
                  {kind === "review-insights" && insights.data && (
                    <AnalyticsStoredReviewInsights report={insights.data} />
                  )}
                  {kind === "timing" && timing.data && (
                    <AnalyticsProfileVisitTiming
                      report={timing.data}
                      retry={() => void timing.refetch()}
                    />
                  )}
                  {kind === "recommendations" && recommendations.data && (
                    <AnalyticsBusinessRecommendations
                      report={recommendations.data}
                      refreshResult={recommendations.refreshResult}
                      refreshError={recommendations.refreshError}
                      requesting={recommendations.isRequestingRefresh}
                      checking={recommendations.isFetching}
                      throttled={recommendations.isThrottled}
                      requestRefresh={recommendations.requestRefresh}
                      checkStatus={() => void recommendations.refetch()}
                    />
                  )}
                </>
              )}
            </PlusRequestState>
          </PlusAccessGate>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
