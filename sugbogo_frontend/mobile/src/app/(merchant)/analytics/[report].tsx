import { Stack, useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import ErrorState from "@/shared/components/ErrorState";
import MerchantAnalyticsDetailScreen, {
  PLUS_DETAIL_TITLES,
  isPlusDetailKind,
} from "@/features/merchant/screens/merchant-mode/MerchantAnalyticsDetailScreen";
import type { MerchantAnalyticsPeriod } from "@/features/merchant/types/merchantAnalytics.types";

/** Validates analytics deep links and keeps report behavior in the merchant feature. */
export default function MerchantAnalyticsDetailRoute() {
  const params = useLocalSearchParams<{ report?: string; period?: string }>();
  const kind = params.report;
  if (!isPlusDetailKind(kind)) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ErrorState
          title="Report not found"
          description="Choose a report from Analytics."
          primaryActionTitle="Go back"
          onPrimaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }
  const period: MerchantAnalyticsPeriod =
    params.period === "7" || params.period === "90" ? params.period : "30";
  return (
    <>
      <Stack.Screen options={{ title: PLUS_DETAIL_TITLES[kind] }} />
      <MerchantAnalyticsDetailScreen kind={kind} initialPeriod={period} />
    </>
  );
}
