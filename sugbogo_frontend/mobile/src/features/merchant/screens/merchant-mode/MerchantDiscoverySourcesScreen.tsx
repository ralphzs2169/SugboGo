import { AnalyticsRowsSkeleton } from "../../components/analytics/AnalyticsLoadingSkeletons";
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
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import Skeleton from "@/shared/components/Skeleton";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { shadows } from "@/shared/styles/shadows";
import AnalyticsChartEmptyState from "../../components/analytics/AnalyticsChartEmptyState";
import AnalyticsOverviewSection from "../../components/analytics/AnalyticsOverviewSection";
import AnalyticsHeaderControls from "../../components/analytics/AnalyticsHeaderControls";
import DiscoverySourcesMeasurementSheet from "../../components/analytics/DiscoverySourcesMeasurementSheet";
import useMerchantDiscoverySources from "../../hooks/analytics/useMerchantDiscoverySources";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";

const PERIOD_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

/** Presents Standard opening-source counts independently of Plus and other reports. */
export default function MerchantDiscoverySourcesScreen({
  initialPeriod = "30",
}: {
  initialPeriod?: MerchantAnalyticsPeriod;
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const focused = useIsFocused();
  const query = useMerchantDiscoverySources(period, focused);
  useApiErrorNotification({
    error: focused ? query.error : null,
    toastId: "discovery-sources-error",
    title: "Unable to load visit sources",
    fallbackMessage: "Please retry this report.",
  });
  return (
    <DiscoverySourcesReportView
      period={period}
      onPeriodChange={setPeriod}
      query={query}
    />
  );
}

/** Query-free report presentation for both the real screen and development fixtures. */
export function DiscoverySourcesReportView({
  period,
  onPeriodChange,
  query,
}: {
  period: MerchantAnalyticsPeriod;
  onPeriodChange: (value: MerchantAnalyticsPeriod) => void;
  query: Pick<
    ReturnType<typeof useMerchantDiscoverySources>,
    "data" | "isPending" | "error" | "isRefetching"
  > & { refetch: () => unknown };
}) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const periodSheetRef = useRef<BottomSheetModal>(null);
  const report = query.data;
  const loading = query.isPending && !report;
  const rows = (report?.sources ?? [])
    .filter((row) => row.count > 0)
    .sort((left, right) => {
      if (left.source === "UNKNOWN") return 1;
      if (right.source === "UNKNOWN") return -1;
      return right.count - left.count;
    });
  const maximum = Math.max(0, ...rows.map((row) => row.count));
  const unavailable =
    report?.meta.availability === "unavailable" ||
    report?.profile_visits === null ||
    report?.sources === null;
  const retry = () => {
    void query.refetch();
  };
  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-surface">
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
        <AnalyticsOverviewSection
          title="Visit sources"
          description="Sources of recorded profile visits"
          accessory={
            <AnalyticsHeaderControls
              period={period}
              onOpenPeriod={() => periodSheetRef.current?.present()}
              onOpenInformation={() => sheetRef.current?.present()}
              informationLabel="About visit sources"
              informationHint="Opens information about recorded visit sources"
            />
          }
        >
          {/* The summary and breakdown headings remain mounted during period changes. */}
          <View className="gap-5">
            <View
              className="min-w-0 rounded-card border border-border-primary/60 bg-surface p-4"
              style={shadows.subtle}
            >
              <View className="flex-row items-start justify-between gap-2">
                <AppText
                  weight="medium"
                  className="min-w-0 flex-1 text-sm leading-5 text-text-secondary"
                >
                  Recorded profile visits
                </AppText>
                <MaterialCommunityIcons
                  name="eye-outline"
                  size={18}
                  color={theme.extends.colors.text.secondary}
                  accessible={false}
                />
              </View>
              <View className="mt-3 gap-1">
                {loading ? (
                  <Skeleton className="h-9 w-24 rounded" />
                ) : (
                  <AppText
                    weight="semibold"
                    className={`text-3xl tabular-nums ${report?.profile_visits == null ? "text-text-secondary" : "text-text-primary"}`}
                    accessibilityLabel={`Recorded profile visits: ${report?.profile_visits ?? "Unavailable"}`}
                  >
                    {formatAnalyticsCount(report?.profile_visits ?? null)}
                  </AppText>
                )}
                <AppText className="text-xs leading-5 text-text-secondary">
                  During selected dates
                </AppText>
              </View>
            </View>
            <View className="gap-5 border-t border-border-primary/60 pt-5">
              <AppText weight="bold" className="text-base text-text-primary">
                Source breakdown
              </AppText>
              {loading && <AnalyticsRowsSkeleton bars />}
              {/* Independent request recovery preserves cached content. */}
              {query.error ? (
                <ErrorState
                  variant="analytics"
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
                  {/* Exact source distribution; unavailable never becomes zero. */}
                  {unavailable ? (
                    !query.error ? (
                      <ErrorState
                        variant="analytics"
                        title="Visit-source data unavailable"
                        description="Recorded visits cannot currently be read. Unavailable counts do not mean zero activity."
                        primaryActionTitle="Retry"
                        onPrimaryAction={retry}
                      />
                    ) : null
                  ) : report.profile_visits === 0 ? (
                    <AnalyticsChartEmptyState
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
                              className={`h-full rounded-full ${row.source === "UNKNOWN" ? "bg-text-tertiary" : "bg-brand"}`}
                              style={{
                                width: `${maximum > 0 ? (row.count / maximum) * 100 : 0}%`,
                                opacity:
                                  row.source === "UNKNOWN" ||
                                  row.count === maximum
                                    ? 1
                                    : 0.6,
                              }}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        </AnalyticsOverviewSection>
      </ScrollView>
      {/* Detailed definitions remain available outside the report's scroll content. */}
      <SelectionBottomSheet
        sheetRef={periodSheetRef}
        title="Reporting period"
        description="Choose a time range for this section."
        options={PERIOD_OPTIONS}
        selectedValue={period}
        onSelect={(value) => {
          if (value === "7" || value === "30" || value === "90") {
            onPeriodChange(value);
          }
        }}
        snapPoints={["50%"]}
      />
      <DiscoverySourcesMeasurementSheet sheetRef={sheetRef} />
    </SafeAreaView>
  );
}
