import { router, useIsFocused } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import AnalyticsPeerComparisons from "../../components/analytics/AnalyticsPeerComparisons";
import AnalyticsStoredReviewInsights from "../../components/analytics/AnalyticsStoredReviewInsights";
import AnalyticsProfileVisitTiming from "../../components/analytics/AnalyticsProfileVisitTiming";
import AnalyticsBusinessRecommendations from "../../components/analytics/AnalyticsBusinessRecommendations";
import { PlusAccessGate } from "../../components/analytics/AnalyticsPlusStates";
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
    { period: "30" },
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
  useQueryErrorNotification({
    error: focused ? access.error : null,
    toastId: "advanced-plus-access",
    title: "Unable to check report access",
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
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-surface">
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
        <View className="bg-surface px-5 py-5">
          <PlusAccessGate access={access}>
            {kind === "timing" ? (
              <AnalyticsProfileVisitTiming
                report={timing.data}
                retry={() => void timing.refetch()}
                period={period}
                onPeriodChange={setPeriod}
                loading={timing.isPending}
                error={timing.error}
              />
            ) : kind === "review-insights" ? (
              <AnalyticsStoredReviewInsights
                report={insights.data}
                loading={insights.isPending}
                error={insights.error}
                retry={() => void insights.refetch()}
              />
            ) : kind === "peers" ? (
              <AnalyticsPeerComparisons
                report={peers.data}
                retry={() => void peers.refetch()}
                period={period}
                onPeriodChange={setPeriod}
                loading={peers.isPending}
                error={peers.error}
              />
            ) : (
              <AnalyticsBusinessRecommendations
                report={recommendations.data}
                refreshResult={recommendations.refreshResult}
                refreshError={recommendations.refreshError}
                requesting={recommendations.isRequestingRefresh}
                checking={recommendations.isFetching}
                throttled={recommendations.isThrottled}
                cooldownRemainingSeconds={
                  recommendations.cooldownRemainingSeconds
                }
                requestRefresh={recommendations.requestRefresh}
                checkStatus={() => void recommendations.refetch()}
                loading={recommendations.isPending}
                error={recommendations.error}
                onOpenAction={(code) => {
                  if (code === "UNANSWERED_REVIEWS") {
                    router.push({
                      pathname: "/(merchant)/(tabs)/reviews",
                      params: {
                        filter: "needs-reply",
                        ordering: "oldest",
                        reviewIntent: String(Date.now()),
                      },
                    });
                  } else if (code === "STORED_INSIGHTS_OUTDATED") {
                    router.push({
                      pathname: "/(merchant)/analytics/[report]",
                      params: { report: "review-insights", period },
                    });
                  }
                }}
              />
            )}
          </PlusAccessGate>
          {__DEV__ && (kind === "peers" || kind === "recommendations") && (
            <SafePressable
              onPress={() =>
                router.push(
                  kind === "peers"
                    ? "/(merchant)/analytics/peer-preview"
                    : "/(merchant)/analytics/recommendations-preview",
                )
              }
              accessibilityLabel={`Open ${kind === "peers" ? "peer comparisons" : "recommendations"} development preview`}
              className="mt-4 min-h-12 cursor-pointer justify-center border-t border-border-primary/60 py-3"
            >
              <AppText className="text-sm text-text-secondary">
                Open development preview
              </AppText>
            </SafePressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
