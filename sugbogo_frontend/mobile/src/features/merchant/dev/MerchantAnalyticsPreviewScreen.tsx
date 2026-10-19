import { router } from "expo-router";
import { useRef, useState } from "react";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ScrollView, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import ErrorState from "@/shared/components/ErrorState";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import AnalyticsChoiceChips from "../components/analytics/AnalyticsChoiceChips";
import AnalyticsMeasurementSheet from "../components/analytics/AnalyitcsMeasurementSheet";
import AnalyticsHeaderControls from "../components/analytics/AnalyticsHeaderControls";
import AnalyticsSourceNotice from "../components/analytics/AnalyticsSourceNotice";
import AnalyticsActivityOverview from "../components/analytics/AnalyticsActivityOverview";
import AnalyticsOverviewSection from "../components/analytics/AnalyticsOverviewSection";
import AnalyticsSectionSkeleton from "../components/analytics/AnalyticsSectionSkeleton";
import AnalyticsSpecialtySupport from "../components/analytics/AnalyticsSpecialtySupport";
import AnalyticsUnansweredReviews from "../components/analytics/AnalyticsUnansweredReviews";
import AnalyticsReviewSummaryPreview from "../components/analytics/AnalyticsReviewSummaryPreview";
import AnalyticsMoreInsights from "../components/analytics/AnalyticsMoreInsights";
import { AnalyticsVisibilityReport } from "../components/analytics/AnalyticsVisibilityTrends";
import AnalyticsRoutePlanning from "../components/analytics/AnalyticsRoutePlanning";
import AnalyticsPocketTrends, {
  AnalyticsPocketHeader,
} from "../components/analytics/AnalyticsPocketTrends";
import AnalyticsReviewPerformance from "../components/analytics/AnalyticsReviewPerformance";
import AnalyticsProfileVisitTiming from "../components/analytics/AnalyticsProfileVisitTiming";
import AnalyticsStoredReviewInsights from "../components/analytics/AnalyticsStoredReviewInsights";
import { DiscoverySourcesReportView } from "../screens/merchant-mode/MerchantDiscoverySourcesScreen";
import type { MerchantAnalyticsPeriod } from "../types/merchantAnalytics.types";
import { previewReports, type PreviewState } from "./analyticsPreviewReports";

type Section =
  | "overview"
  | "specialties"
  | "unanswered"
  | "visibility"
  | "routes"
  | "reports"
  | "discovery"
  | "pocket"
  | "reviews"
  | "timing"
  | "insights"
  | "summary";
const SECTIONS: { value: Section; label: string }[] = [
  { value: "overview", label: "Business overview" },
  { value: "specialties", label: "Current specialties" },
  { value: "unanswered", label: "Needs reply" },
  { value: "visibility", label: "Visibility" },
  { value: "summary", label: "Review summary" },
  { value: "routes", label: "Routes" },
  { value: "reports", label: "Report navigation" },
  { value: "discovery", label: "Visit sources" },
  { value: "pocket", label: "Pocket" },
  { value: "reviews", label: "Review performance" },
  { value: "timing", label: "Visit timing" },
  { value: "insights", label: "Review insights" },
];
const STATES: { value: PreviewState; label: string }[] = [
  { value: "populated", label: "Populated" },
  { value: "zero", label: "Zero / Empty" },
  { value: "sparse", label: "Sparse" },
  { value: "partial", label: "Partial" },
  { value: "unavailable", label: "Unavailable" },
  { value: "error", label: "Request error" },
  { value: "loading", label: "Loading" },
  { value: "uninitialized", label: "Uninitialized" },
  { value: "outdated", label: "Outdated" },
  { value: "insufficient", label: "Insufficient reviews" },
];
const PERIODS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

/** Development-only gallery of production renderers. All actions are local simulations. */
export default function MerchantAnalyticsPreviewScreen() {
  const [section, setSection] = useState<Section>("overview");
  const [state, setState] = useState<PreviewState>("populated");
  const [period, setPeriod] = useState<MerchantAnalyticsPeriod>("30");
  const [interval, setInterval] = useState<"daily" | "weekly">("weekly");
  const [notice, setNotice] = useState("");
  const sheetRef = useRef<BottomSheetModal>(null);
  const measurementRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const reports = previewReports(period, state, interval);
  const loading = state === "loading";
  const error =
    state === "error" ? new Error("Synthetic report failure") : null;
  const retry = () => setState("populated");
  const hidden = loading || Boolean(error);
  const actions = (label: string) =>
    setNotice(`Demo action: ${label}. No real navigation or requests.`);
  const choices = STATES.filter((item) => {
    if (section === "reports") return item.value === "populated";
    if (item.value === "insufficient")
      return (
        section === "reviews" || section === "insights" || section === "summary"
      );
    if (item.value === "uninitialized") return section === "routes";
    if (item.value === "outdated")
      return section === "insights" || section === "summary";
    if (item.value === "sparse")
      return ["visibility", "pocket", "reviews", "timing"].includes(section);
    if (item.value === "partial")
      return [
        "overview",
        "visibility",
        "routes",
        "pocket",
        "reviews",
        "discovery",
        "timing",
      ].includes(section);
    if (item.value === "unavailable") return section !== "unanswered";
    return true;
  });
  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-surface">
      <View className="gap-3 border-b border-border-primary px-5 py-3">
        <AppText weight="bold" className="text-sm text-text-primary">
          Development preview - Synthetic data
        </AppText>
        <AppText className="text-xs leading-5 text-text-secondary">
          No report APIs, database writes, or generation. Retry restores
          populated data. Dates are illustrative.
        </AppText>
        <ScrollView horizontal>
          <View className="flex-row">
            <AnalyticsChoiceChips
              label="Section"
              options={SECTIONS}
              value={section}
              onChange={(value) => {
                setSection(value);
                setState("populated");
                setNotice("");
              }}
            />
          </View>
        </ScrollView>
        <AnalyticsChoiceChips
          label="State"
          options={choices}
          value={state}
          onChange={setState}
        />
        {notice ? (
          <AppText
            accessibilityLiveRegion="polite"
            className="text-xs text-brand"
          >
            {notice}
          </AppText>
        ) : null}
      </View>
      {section === "discovery" ? (
        <DiscoverySourcesReportView
          period={period}
          onPeriodChange={setPeriod}
          query={{
            data: hidden ? undefined : reports.discovery,
            isPending: loading,
            isRefetching: false,
            error,
            refetch: retry,
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className="py-4">
            {section === "overview" && (
              <AnalyticsOverviewSection
                title="Business overview"
                description="Synthetic business activity"
                accessory={
                  <AnalyticsHeaderControls
                    period={period}
                    onOpenPeriod={() => sheetRef.current?.present()}
                    onOpenInformation={() => measurementRef.current?.present()}
                    informationLabel="How analytics are measured"
                    informationHint="Opens measurement details"
                  />
                }
              >
                {loading ? (
                  <AnalyticsSectionSkeleton section="activity" />
                ) : error ? (
                  <ErrorState
                    variant="analytics"
                    description="Synthetic request failed. Retry restores the demo."
                    title="Unable to load analytics"
                    primaryActionTitle="Retry"
                    onPrimaryAction={retry}
                  />
                ) : (
                  <View className="gap-4">
                    <AnalyticsActivityOverview report={reports.standard} />
                    <AnalyticsSourceNotice
                      report={reports.standard}
                      onRetry={retry}
                    />
                  </View>
                )}
              </AnalyticsOverviewSection>
            )}
            {section === "specialties" && (
              <AnalyticsOverviewSection title="Specialty vouches">
                {loading ? (
                  <AnalyticsSectionSkeleton section="specialties" />
                ) : error ? (
                  <ErrorState
                    variant="analytics"
                    description="Synthetic request failed. Retry restores the demo."
                    title="Unable to load specialties"
                    primaryActionTitle="Retry"
                    onPrimaryAction={retry}
                  />
                ) : (
                  <AnalyticsSpecialtySupport
                    report={reports.standard}
                    specialtyTags={[]}
                    onRetry={retry}
                  />
                )}
              </AnalyticsOverviewSection>
            )}
            {section === "unanswered" && (
              <AnalyticsUnansweredReviews
                data={hidden ? undefined : reports.unanswered}
                loading={loading}
                error={error}
                onRetry={retry}
                onReview={() => actions("Reviews, Needs reply, Oldest first")}
              />
            )}
            {section === "visibility" && (
              <AnalyticsVisibilityReport
                period={period}
                onOpenPeriod={() => sheetRef.current?.present()}
                interval={interval}
                onIntervalChange={setInterval}
                query={{
                  data: hidden ? undefined : reports.visibility,
                  isPending: loading,
                  error,
                  refetch: retry,
                }}
              />
            )}
            {section === "summary" && (
              <AnalyticsReviewSummaryPreview
                report={hidden ? undefined : reports.insights}
                loading={loading}
                error={error}
                onRetry={retry}
                onOpen={() => actions("Full review insights report")}
              />
            )}
            {section === "routes" && (
              <AnalyticsRoutePlanning
                period={period}
                onOpenPeriod={() => sheetRef.current?.present()}
                data={hidden ? undefined : reports.routes}
                loading={loading}
                error={error}
                onRetry={retry}
              />
            )}
            {section === "reports" && (
              <AnalyticsMoreInsights
                onOpen={(kind) => actions(kind)}
                onOpenDiscoverySources={() => actions("Visit sources")}
              />
            )}
            <View className="px-5">
              {section === "pocket" && (
                <View className="gap-5">
                  <AnalyticsPocketHeader
                    period={period}
                    onPeriodChange={setPeriod}
                    report={hidden ? undefined : reports.pocket}
                  />
                  {error ? (
                    <ErrorState
                      variant="analytics"
                      description="Synthetic request failed. Retry restores the demo."
                      title="Unable to load saves"
                      primaryActionTitle="Retry"
                      onPrimaryAction={retry}
                    />
                  ) : (
                    <AnalyticsPocketTrends
                      report={hidden ? undefined : reports.pocket}
                      loading={loading}
                      retry={retry}
                    />
                  )}
                </View>
              )}
              {section === "reviews" && (
                <AnalyticsReviewPerformance
                  report={hidden ? undefined : reports.reviews}
                  period={period}
                  onPeriodChange={setPeriod}
                  loading={loading}
                  error={error}
                  retry={retry}
                />
              )}
              {section === "timing" && (
                <AnalyticsProfileVisitTiming
                  report={hidden ? undefined : reports.timing}
                  period={period}
                  onPeriodChange={setPeriod}
                  loading={loading}
                  error={error}
                  retry={retry}
                />
              )}
              {section === "insights" && (
                <AnalyticsStoredReviewInsights
                  onOpenReviews={() =>
                    actions("Reviews, All reviews, Newest first")
                  }
                  report={hidden ? undefined : reports.insights}
                  loading={loading}
                  error={error}
                  retry={retry}
                />
              )}
            </View>
            <View className="gap-2 px-5 pt-5">
              {[
                {
                  label: "Peer comparisons preview",
                  path: "/(merchant)/analytics/peer-preview",
                },
                {
                  label: "Recommendations preview",
                  path: "/(merchant)/analytics/recommendations-preview",
                },
                {
                  label: "Specialty trends preview",
                  path: "/(merchant)/analytics/specialties-preview",
                },
              ].map((item) => (
                <SafePressable
                  key={item.path}
                  onPress={() =>
                    router.push(
                      item.path as "/(merchant)/analytics/peer-preview",
                    )
                  }
                  className="min-h-11 cursor-pointer justify-center"
                >
                  <AppText className="text-sm text-brand">{item.label}</AppText>
                </SafePressable>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
      <AnalyticsMeasurementSheet
        sheetRef={measurementRef}
        report={hidden ? undefined : reports.standard}
      />
      <SelectionBottomSheet
        sheetRef={sheetRef}
        title="Preview reporting period"
        options={PERIODS}
        selectedValue={period}
        onSelect={(value) => {
          if (value === "7" || value === "30" || value === "90")
            setPeriod(value);
        }}
        snapPoints={["50%"]}
      />
    </SafeAreaView>
  );
}
