import { ScrollView, View, useWindowDimensions } from "react-native";
import AppText from "@/shared/components/AppText";
import Skeleton from "@/shared/components/Skeleton";

/** Reserves axes, plot area, dates, and exact-values action without suggesting real observations. */
export function AnalyticsChartSkeleton() {
  return (
    <View
      accessibilityLabel="Loading chart"
      accessibilityState={{ busy: true }}
      className="gap-4 py-2"
    >
      <View className="flex-row gap-3">
        <View className="justify-between pb-5">
          <Skeleton className="h-3 w-6 rounded" />
          <Skeleton className="h-3 w-6 rounded" />
          <Skeleton className="h-3 w-6 rounded" />
        </View>
        <View className="min-w-0 flex-1 gap-3">
          <Skeleton className="h-36 w-full rounded-lg" />
          <View className="flex-row justify-between">
            <Skeleton className="h-3 w-10 rounded" />
            <Skeleton className="h-3 w-10 rounded" />
            <Skeleton className="h-3 w-10 rounded" />
          </View>
        </View>
      </View>
      <View className="flex-row items-center gap-2 border-t border-border-primary/60 pt-3">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-28 rounded" />
      </View>
    </View>
  );
}

/** Labeled ranking/legend rows, optionally with their horizontal bars. */
export function AnalyticsRowsSkeleton({
  bars = false,
  count = 3,
}: {
  bars?: boolean;
  count?: number;
}) {
  return (
    <View
      accessibilityLabel="Loading breakdown"
      accessibilityState={{ busy: true }}
      className="gap-4"
    >
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          className="gap-3 border-b border-border-primary/60 pb-3"
        >
          <View className="flex-row items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <View className="min-w-0 flex-1 gap-2">
              <Skeleton className="h-4 w-32 max-w-full rounded" />
              {!bars && <Skeleton className="h-3 w-24 rounded" />}
            </View>
            <Skeleton className="h-5 w-8 rounded" />
          </View>
          {bars && <Skeleton className="h-2 w-full rounded-full" />}
        </View>
      ))}
    </View>
  );
}

export function AnalyticsDonutSkeleton() {
  return (
    <View className="h-36 w-36 items-center justify-center self-center">
      <Skeleton className="absolute h-36 w-36 rounded-full" />
      <View className="h-24 w-24 items-center justify-center gap-2 rounded-full bg-surface">
        <Skeleton className="h-7 w-10 rounded" />
        <Skeleton className="h-3 w-12 rounded" />
      </View>
    </View>
  );
}

export function AnalyticsHeatmapSkeleton() {
  return (
    <View
      accessibilityLabel="Loading visit timing"
      accessibilityState={{ busy: true }}
      className="flex-row gap-3 py-2"
    >
      <View className="gap-2 pt-6">
        {Array.from({ length: 7 }, (_, index) => (
          <View key={index} className="h-6 justify-center">
            <Skeleton className="h-3 w-7 rounded" />
          </View>
        ))}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <View className="gap-2">
          <View className="flex-row justify-between pb-1">
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-3 w-12 rounded" />
          </View>
          {Array.from({ length: 7 }, (_, row) => (
            <View key={row} className="flex-row gap-1">
              {Array.from({ length: 24 }, (_, column) => (
                <Skeleton key={column} className="h-6 w-6 rounded" />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function AnalyticsFeedbackSkeleton() {
  return (
    <View
      accessibilityLabel="Loading customer feedback"
      accessibilityState={{ busy: true }}
      className="gap-4"
    >
      <Skeleton className="h-3 w-full rounded-full" />
      <AnalyticsRowsSkeleton />
    </View>
  );
}

export function AnalyticsRecommendationSkeleton() {
  return (
    <View
      accessibilityLabel="Loading recommendations"
      accessibilityState={{ busy: true }}
      className="gap-4"
    >
      {[0, 1].map((index) => (
        <View
          key={index}
          className="gap-4 rounded-card border border-border-primary/60 bg-surface-muted p-4"
        >
          <View className="flex-row items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </View>
          <Skeleton className="h-6 w-48 max-w-full rounded" />
          <View className="gap-2">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-4/5 rounded" />
          </View>
          <View className="gap-2 border-t border-border-primary/60 pt-3">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3 w-full rounded" />
          </View>
          <Skeleton className="h-4 w-32 rounded" />
        </View>
      ))}
    </View>
  );
}

export function AnalyticsInsightsSkeleton() {
  return (
    <View
      accessibilityLabel="Loading review insights"
      accessibilityState={{ busy: true }}
      className="gap-5"
    >
      <Skeleton className="h-4 w-48 max-w-full rounded" />
      <View className="gap-4 rounded-card bg-surface-muted p-4">
        <View className="flex-row flex-wrap justify-between gap-3">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </View>
        <View className="gap-3">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-4/5 rounded" />
          <Skeleton className="h-3 w-3/5 rounded" />
        </View>
        <Skeleton className="h-3 w-28 rounded" />
      </View>
      <View className="gap-4 border-t border-border-primary/60 pt-5">
        <AppText weight="bold" className="text-base text-text-primary">
          Commonly mentioned
        </AppText>
        <AnalyticsRowsSkeleton />
      </View>
    </View>
  );
}

export function AnalyticsSpecialtyTrendsSkeleton() {
  return (
    <View
      accessibilityLabel="Loading specialty activity"
      accessibilityState={{ busy: true }}
      className="gap-5"
    >
      <View className="flex-row flex-wrap gap-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-8 w-24 rounded-full" />
        ))}
      </View>
      <View className="gap-3 border-t border-border-primary/60 pt-5">
        <AppText weight="bold" className="text-base text-text-primary">
          Vouches over time
        </AppText>
        <AppText className="text-sm text-text-secondary">
          Weekly additions that still count
        </AppText>
        <AnalyticsChartSkeleton />
      </View>
      <View className="gap-4 border-t border-border-primary/60 pt-5">
        <AppText weight="bold" className="text-base text-text-primary">
          Specialty breakdown
        </AppText>
        <AnalyticsDonutSkeleton />
        <AnalyticsRowsSkeleton />
      </View>
    </View>
  );
}

export function AnalyticsRoutePlanningSkeleton() {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale >= 1.3;
  return (
    <View
      accessibilityLabel="Loading route-planning activity"
      accessibilityState={{ busy: true }}
      className="gap-4 rounded-card bg-surface-muted p-4"
    >
      <View className={stacked ? "gap-4" : "flex-row items-center gap-5"}>
        <AnalyticsDonutSkeleton />
        <View className={stacked ? "w-full" : "min-w-0 flex-1"}>
          <AnalyticsRowsSkeleton count={2} />
        </View>
      </View>
      <View className="flex-row items-center justify-between gap-3 border-t border-border-primary/60 pt-4">
        <Skeleton className="h-4 w-36 rounded" />
        <Skeleton className="h-5 w-8 rounded" />
      </View>
    </View>
  );
}
