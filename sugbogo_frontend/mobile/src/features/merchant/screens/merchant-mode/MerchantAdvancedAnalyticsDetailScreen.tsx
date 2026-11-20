import { useIsFocused } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import AnalyticsPeerComparisons from "../../components/analytics/AnalyticsPeerComparisons";
import AnalyticsStoredReviewInsights from "../../components/analytics/AnalyticsStoredReviewInsights";
import AnalyticsProfileVisitTiming from "../../components/analytics/AnalyticsProfileVisitTiming";
import {
  useMerchantPlusPeers,
  useMerchantReviewInsights,
  useMerchantPlusTiming,
} from "../../hooks/analytics/useMerchantAdvancedAnalytics";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import type { AdvancedPlusDetailKind } from "../../types/merchantPlusAnalytics.types";
import useMerchantPlusAccess from "../../hooks/analytics/useMerchantPlusAccess";
import { PlusAccessGate } from "../../components/analytics/AnalyticsPlusStates";

/** Lazily loads the selected advanced analytics report. */
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
  const access = useMerchantPlusAccess();
  const insets = useSafeAreaInsets();
  const enabled = focused && access.allowed;
  const selection = { period };
  const peers = useMerchantPlusPeers(selection, enabled && kind === "peers");
  const insights = useMerchantReviewInsights(
    focused && kind === "review-insights",
  );
  const timing = useMerchantPlusTiming(selection, enabled && kind === "timing");
  const query =
    kind === "peers"
      ? peers
      : kind === "review-insights"
        ? insights
        : timing;
  useQueryErrorNotification({
    error: focused ? query.error : null,
    toastId: `advanced-plus-${kind}`,
    title: "Unable to load analytics",
    fallbackMessage: "Please retry this report.",
  });
  const refresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };
  if (kind !== "review-insights" && !access.allowed) {
    return (
      <SafeAreaView className="flex-1 bg-surface px-5 py-5">
        <PlusAccessGate access={access}>{null}</PlusAccessGate>
      </SafeAreaView>
    );
  }
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
          <View>
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
            ) : (
              <AnalyticsPeerComparisons
                report={peers.data}
                retry={() => void peers.refetch()}
                period={period}
                onPeriodChange={setPeriod}
                loading={peers.isPending}
                error={peers.error}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
