import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useIsFocused } from "expo-router";
import { useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import AnalyticsChartEmptyState from "../../components/analytics/AnalyticsChartEmptyState";
import AnalyticsOverviewSection from "../../components/analytics/AnalyticsOverviewSection";
import AnalyticsDetailHeader from "../../components/analytics/AnalyticsDetailHeader";
import DiscoverySourcesMeasurementSheet from "../../components/analytics/DiscoverySourcesMeasurementSheet";
import useMerchantDiscoverySources from "../../hooks/analytics/useMerchantDiscoverySources";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";

/** Presents Standard opening-source counts independently of Plus and other reports. */
export default function MerchantDiscoverySourcesScreen({
  initialPeriod = "30",
}: {
  initialPeriod?: MerchantAnalyticsPeriod;
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const focused = useIsFocused();
  const query = useMerchantDiscoverySources(period, focused);
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const report = query.data;
  const rows = (report?.sources ?? [])
    .filter((row) => row.count > 0)
    .sort((left, right) => right.count - left.count);
  const maximum = rows[0]?.count ?? 0;
  const unavailable =
    report?.meta.availability === "unavailable" ||
    report?.profile_visits === null ||
    report?.sources === null;
  const retry = () => {
    void query.refetch();
  };
  useApiErrorNotification({
    error: focused ? query.error : null,
    toastId: "discovery-sources-error",
    title: "Unable to load visit sources",
    fallbackMessage: "Please retry this report.",
  });
  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-background">
      {/* Standard report navigation and query ownership remain independent of Plus. */}
      <ScrollView
        testID="discovery-sources-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={retry}
            tintColor={theme.extends.colors.brand}
            colors={[theme.extends.colors.brand]}
          />
        }
      >
        <AnalyticsDetailHeader
          title="Where visits came from"
          description="Sources of recorded business profile visits."
          period={period}
          onPeriodChange={setPeriod}
        />
        <AnalyticsOverviewSection
          title="Recorded profile visits"
          accessory={
            <SafePressable
              onPress={() => sheetRef.current?.present()}
              accessibilityRole="button"
              accessibilityLabel="About visit sources"
              className="h-11 w-11 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
            >
              <MaterialCommunityIcons
                name="information-outline"
                size={20}
                accessible={false}
                color={theme.extends.colors.text.secondary}
              />
            </SafePressable>
          }
        >
          {/* Initial loading and independent request recovery */}
          {query.isPending && !report ? (
            <View accessibilityLabel="Loading visit sources" className="gap-4">
              <Skeleton className="h-10 w-24 rounded" />
              <Skeleton className="h-40 w-full rounded" />
            </View>
          ) : null}
          {query.error ? (
            <ErrorState
              size="section"
              title={
                report
                  ? "Unable to refresh visit sources"
                  : "Unable to load visit sources"
              }
              description={
                report
                  ? "Previously loaded values are still shown."
                  : "Please try this report again."
              }
              primaryActionTitle="Retry"
              onPrimaryAction={retry}
            />
          ) : null}
          {report ? (
            <View className="gap-5">
              <AppText
                weight="semibold"
                className="text-3xl tabular-nums text-text-primary"
                accessibilityLabel={`Recorded profile visits: ${report.profile_visits ?? "Unavailable"}`}
              >
                {formatAnalyticsCount(report.profile_visits)}
              </AppText>
              {/* Exact source distribution; unavailable never becomes zero. */}
              {unavailable ? (
                !query.error ? (
                  <ErrorState
                    size="section"
                    title="Visit-source data unavailable"
                    description="Recorded visits cannot currently be read. Unavailable counts do not mean zero activity."
                    primaryActionTitle="Retry"
                    onPrimaryAction={retry}
                  />
                ) : null
              ) : report.profile_visits === 0 ? (
                <AnalyticsChartEmptyState
                  compact
                  icon="compass-outline"
                  title="No recorded profile visits yet"
                  description="No profile visits were recorded for these dates."
                />
              ) : (
                <View className="gap-5">
                  {rows.map((row) => (
                    <View
                      key={row.source}
                      accessible
                      accessibilityLabel={`${row.label}: ${row.count} recorded profile visits`}
                      className="gap-2"
                    >
                      <View className="flex-row items-center justify-between gap-3">
                        <AppText className="min-w-0 flex-1 text-sm text-text-primary">
                          {row.label}
                        </AppText>
                        <AppText
                          weight="semibold"
                          className="text-sm text-text-primary"
                        >
                          {formatAnalyticsCount(row.count)}
                        </AppText>
                      </View>
                      <View
                        accessible={false}
                        className="h-2 overflow-hidden rounded-full bg-surface-muted"
                      >
                        <View
                          testID={`discovery-source-bar-${row.source}`}
                          className="h-full rounded-full bg-brand"
                          style={{
                            width: `${maximum > 0 ? (row.count / maximum) * 100 : 0}%`,
                          }}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
              {report.attribution_complete === false ? (
                <AppText className="text-xs leading-5 text-text-secondary">
                  Some visits have no recorded source. They remain included in
                  the total.
                </AppText>
              ) : null}
              <AppText className="text-xs leading-5 text-text-secondary">
                App-reported sources · Recorded activity may be incomplete.
              </AppText>
            </View>
          ) : null}
        </AnalyticsOverviewSection>
      </ScrollView>
      {/* Detailed definitions remain available outside the report's scroll content. */}
      <DiscoverySourcesMeasurementSheet sheetRef={sheetRef} />
    </SafeAreaView>
  );
}
