import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef } from "react";
import { View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import type { RoutePlanningAnalytics } from "../../types/routePlanningAnalytics.types";
import {
  formatAnalyticsCount,
  formatAnalyticsTimestamp,
} from "../../utils/merchantAnalytics.utils";
import AnalyticsOverviewSection from "./AnalyticsOverviewSection";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";
import AnalyticsRoutePlanningSheet from "./AnalyticsRoutePlanningSheet";

/** Presents method-level recorded guidance interest without implying completed visits. */
export default function AnalyticsRoutePlanning({
  data,
  loading,
  error,
  onRetry,
}: {
  data?: RoutePlanningAnalytics;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const unavailable = data?.meta.availability === "unavailable";
  const partialCounts =
    data &&
    !unavailable &&
    [
      data.total_requests,
      data.distinct_explorer_accounts,
      data.road_route_requests,
      data.jeepney_requests,
    ].some((value) => value === null);
  const methods = data
    ? [
        {
          label: "Road Route",
          count: data.road_route_requests,
          color: "bg-brand",
          key: "road",
        },
        {
          label: "Jeepney guidance",
          count: data.jeepney_requests,
          color: "bg-brand/50",
          key: "jeepney",
        },
      ]
    : [];

  return (
    <>
      <AnalyticsOverviewSection
        title="Route-planning activity"
        accessory={
          <SafePressable
            onPress={() => sheetRef.current?.present()}
            accessibilityRole="button"
            accessibilityLabel="About route-planning activity"
            accessibilityHint="Opens measurement definitions and limitations"
            className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-muted"
          >
            <MaterialCommunityIcons
              accessible={false}
              name="information-outline"
              size={22}
              color={theme.extends.colors.text.secondary}
            />
          </SafePressable>
        }
      >
        {/* Independent loading and persistent request recovery */}
        {loading && !data ? (
          <View
            accessibilityLabel="Loading route-planning activity"
            accessibilityState={{ busy: true }}
            className="gap-3"
          >
            <Skeleton className="h-9 w-24 rounded" />
            <Skeleton className="h-4 w-48 rounded" />
            <Skeleton className="h-16 w-full rounded" />
          </View>
        ) : null}
        {error ? (
          <ErrorState
            size="section"
            title={
              data
                ? "Unable to refresh route-planning activity"
                : "Unable to load route-planning activity"
            }
            description={
              data
                ? "Previously loaded activity is still shown."
                : "Please try this section again."
            }
            primaryActionTitle="Retry"
            onPrimaryAction={onRetry}
          />
        ) : null}
        {data ? (
          <View className="gap-4">
            {/* Exact backend totals and distinct accounts; unavailable never becomes zero. */}
            <View className="gap-1">
              <AppText className="text-sm text-text-secondary">
                Recorded route requests
              </AppText>
              <AppText
                weight="bold"
                className="text-3xl text-text-primary"
                accessibilityLabel={`Recorded route requests: ${data.total_requests ?? "Unavailable"}`}
              >
                {formatAnalyticsCount(data.total_requests)}
              </AppText>
              <AppText
                className="text-sm text-text-secondary"
                accessibilityLabel={`Explorer accounts: ${data.distinct_explorer_accounts ?? "Unavailable"}`}
              >
                {formatAnalyticsCount(data.distinct_explorer_accounts)} explorer
                accounts
              </AppText>
            </View>
            {unavailable ? (
              <AnalyticsChartEmptyState
                compact
                icon="map-marker-path"
                title="Route-planning data unavailable"
                description={
                  data.meta.partial_reasons.includes(
                    "tracking_not_started_in_period",
                  )
                    ? "Tracking had not started during these dates."
                    : "Recorded guidance activity cannot currently be displayed."
                }
                onRetry={
                  data.meta.partial_reasons.includes(
                    "tracking_not_started_in_period",
                  )
                    ? undefined
                    : onRetry
                }
              />
            ) : (
              <>
                {data.total_requests === 0 ? (
                  <AppText className="text-sm leading-5 text-text-secondary">
                    No recorded route requests for the selected dates.
                  </AppText>
                ) : null}
                {/* Equal-scale bars represent shares of recorded requests, not visit conversions. */}
                {methods.map((method) => (
                  <View
                    key={method.key}
                    accessible
                    accessibilityLabel={`${method.label}: ${method.count ?? "Unavailable"} recorded requests`}
                    className="gap-2"
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <AppText className="min-w-0 flex-1 text-sm text-text-primary">
                        {method.label}
                      </AppText>
                      <AppText
                        weight="semibold"
                        className="text-sm text-text-primary"
                      >
                        {formatAnalyticsCount(method.count)}
                      </AppText>
                    </View>
                    <View
                      accessible={false}
                      className="h-2 overflow-hidden rounded-full bg-surface-muted"
                    >
                      {method.count !== null &&
                      data.total_requests !== null &&
                      data.total_requests > 0 ? (
                        <View
                          testID={`route-planning-bar-${method.key}`}
                          className={`h-full rounded-full ${method.color}`}
                          style={{
                            width: `${Math.min(100, (method.count / data.total_requests) * 100)}%`,
                          }}
                        />
                      ) : null}
                    </View>
                  </View>
                ))}
              </>
            )}
            <AppText className="text-xs leading-5 text-text-secondary">
              Guidance requests, not confirmed visits.
            </AppText>
            {partialCounts ? (
              <AppText className="text-xs leading-5 text-text-secondary">
                Some route-planning counts are unavailable.
              </AppText>
            ) : null}
            {data.tracking_started_at &&
            data.meta.partial_reasons.includes(
              "tracking_started_during_period",
            ) ? (
              <AppText className="text-xs leading-5 text-text-secondary">
                Tracking began{" "}
                {formatAnalyticsTimestamp(data.tracking_started_at)} Manila
                time. Earlier activity is unavailable.
              </AppText>
            ) : null}
          </View>
        ) : null}
      </AnalyticsOverviewSection>
      {/* Measurement details stay out of the compact overview. */}
      <AnalyticsRoutePlanningSheet sheetRef={sheetRef} report={data} />
    </>
  );
}
