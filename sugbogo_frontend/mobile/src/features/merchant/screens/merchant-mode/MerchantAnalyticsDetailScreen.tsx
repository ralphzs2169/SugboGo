import { useIsFocused } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import AnalyticsChartEmptyState from "../../components/analytics/AnalyticsChartEmptyState";
import InfoBanner from "@/shared/components/InfoBanner";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import AnalyticsPeriodSelector from "../../components/analytics/AnalyticsPeriodSelector";
import AnalyticsPocketTrends from "../../components/analytics/AnalyticsPocketTrends";
import AnalyticsReviewPerformance from "../../components/analytics/AnalyticsReviewPerformance";
import AnalyticsSpecialtyTrends from "../../components/analytics/AnalyticsSpecialtyTrends";
import {
  PlusAccessGate,
  PlusRequestState,
} from "../../components/analytics/AnalyticsPlusStates";
import useMerchantPlusAccess from "../../hooks/analytics/useMerchantPlusAccess";
import {
  useMerchantPlusPocket,
  useMerchantPlusReviews,
  useMerchantPlusSpecialties,
} from "../../hooks/analytics/useMerchantPlusAnalytics";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import MerchantContentSection from "../../layout/MerchantContentSection";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import type {
  PlusDetailKind,
  CorePlusDetailKind,
  PlusSpecialtyReport,
} from "../../types/merchantPlusAnalytics.types";
import MerchantAdvancedAnalyticsDetailScreen from "./MerchantAdvancedAnalyticsDetailScreen";

export const PLUS_DETAIL_TITLES: Record<PlusDetailKind, string> = {
  pocket: "Pocket Trends",
  specialties: "Specialty Trends",
  reviews: "Review Performance",
  peers: "Peer Comparisons",
  "review-insights": "Review Insights",
  timing: "Profile-Visit Timing",
  recommendations: "Business Recommendations",
};

export function isPlusDetailKind(value: unknown): value is PlusDetailKind {
  return typeof value === "string" && Object.hasOwn(PLUS_DETAIL_TITLES, value);
}

/** Keeps one route contract while advanced reports load independently of Core Plus. */
export default function MerchantAnalyticsDetailScreen({
  kind,
  initialPeriod = "30",
}: {
  kind: PlusDetailKind;
  initialPeriod?: MerchantAnalyticsPeriod;
}) {
  if (kind === "pocket" || kind === "specialties" || kind === "reviews") {
    return (
      <CoreAnalyticsDetailScreen kind={kind} initialPeriod={initialPeriod} />
    );
  }
  return (
    <MerchantAdvancedAnalyticsDetailScreen
      kind={kind}
      initialPeriod={initialPeriod}
      title={PLUS_DETAIL_TITLES[kind]}
    />
  );
}

/** Retrieves specialty styling only for an authorized specialty detail. */
function SpecialtyDetail({ report }: { report: PlusSpecialtyReport }) {
  const profile = useMerchantBusinessProfile();
  return (
    <View className="gap-4">
      <AnalyticsSpecialtyTrends
        report={report}
        tags={
          profile.business?.id === report.business.id
            ? profile.business.specialty_tags
            : []
        }
      />
      {profile.error && (
        <InfoBanner
          title="Specialty icons and colors unavailable"
          actionTitle="Retry"
          onAction={() => void profile.refetch()}
        >
          <AppText className="text-sm leading-5 text-text-secondary">
            Counts are still available. Specialty icons and colors could not
            refresh.
          </AppText>
        </InfoBanner>
      )}
    </View>
  );
}

/** Loads one focused Plus detail while retaining the overview's selected period on entry. */
function CoreAnalyticsDetailScreen({
  kind,
  initialPeriod = "30",
}: {
  kind: CorePlusDetailKind;
  initialPeriod?: MerchantAnalyticsPeriod;
}) {
  const [period, setPeriod] = useState<MerchantAnalyticsPeriod>(initialPeriod);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const access = useMerchantPlusAccess();
  const enabled = access.allowed && focused;
  const selection = { period };
  const pocket = useMerchantPlusPocket(selection, enabled && kind === "pocket");
  const specialties = useMerchantPlusSpecialties(
    selection,
    enabled && kind === "specialties",
  );
  const reviews = useMerchantPlusReviews(
    selection,
    enabled && kind === "reviews",
  );
  const query =
    kind === "pocket" ? pocket : kind === "specialties" ? specialties : reviews;

  useQueryErrorNotification({
    error: focused ? access.error : null,
    toastId: "plus-detail-access",
    title: "Unable to check Plus access",
    fallbackMessage: "Please retry the access check.",
  });
  useQueryErrorNotification({
    error: focused ? query.error : null,
    toastId: `plus-detail-${kind}`,
    title: "Unable to load analytics",
    fallbackMessage: "Please retry this report.",
  });

  const refresh = async () => {
    setRefreshing(true);
    try {
      const result = await access.refetch();
      if (!result.error && result.data?.has_plus_access) await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-background">
      {/* Native stack owns the header; date controls remain visible through request failures. */}
      <View className="bg-surface px-5 pb-3 pt-2">
        <AppText className="text-sm text-text-secondary">
          Selected dates · Manila time
        </AppText>
        <AnalyticsPeriodSelector period={period} onChange={setPeriod} />
      </View>
      <ScrollView
        testID="plus-detail-scroll"
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
        <MerchantContentSection title={PLUS_DETAIL_TITLES[kind]}>
          <PlusAccessGate access={access}>
            <PlusRequestState
              error={query.error}
              hasData={!!query.data}
              loading={query.isPending}
              retry={() => void query.refetch()}
            >
              {/* Unavailable report states never become successful empty charts. */}
              {query.data?.meta.availability === "unavailable" ? (
                <AnalyticsChartEmptyState
                  title="Report data unavailable"
                  description="This report could not be loaded. Unavailable counts do not mean zero activity."
                  icon="cloud-off-outline"
                  onRetry={() => void query.refetch()}
                />
              ) : (
                <>
                  {kind === "pocket" && pocket.data && (
                    <AnalyticsPocketTrends
                      report={pocket.data}
                      retry={() => void pocket.refetch()}
                    />
                  )}
                  {kind === "specialties" && specialties.data && (
                    <SpecialtyDetail report={specialties.data} />
                  )}
                  {kind === "reviews" && reviews.data && (
                    <AnalyticsReviewPerformance report={reviews.data} />
                  )}
                </>
              )}
            </PlusRequestState>
          </PlusAccessGate>
        </MerchantContentSection>
      </ScrollView>
    </SafeAreaView>
  );
}
