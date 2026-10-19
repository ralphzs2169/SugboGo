import { useState } from "react";
import { ScrollView, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AppText from "@/shared/components/AppText";
import AnalyticsChoiceChips from "../components/analytics/AnalyticsChoiceChips";
import AnalyticsPeerComparisons from "../components/analytics/AnalyticsPeerComparisons";
import type { MerchantAnalyticsPeriod } from "../types/merchantAnalytics.types";
import {
  peerPreviewReport,
  type PeerPreviewScenario,
} from "./peerComparisonPreview.fixtures";

const OPTIONS: { value: PeerPreviewScenario; label: string }[] = [
  { value: "populated", label: "Populated" },
  { value: "insufficient", label: "Insufficient" },
  { value: "partial", label: "Partial" },
  { value: "unavailable", label: "Unavailable" },
  { value: "zeros", label: "Zeros" },
  { value: "loading", label: "Loading" },
];

/** No authentication, report hooks, API services, or persistence in this preview. */
export default function MerchantPeerPreviewScreen() {
  const [period, setPeriod] = useState<MerchantAnalyticsPeriod>("30");
  const [scenario, setScenario] = useState<PeerPreviewScenario>("populated");
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View className="gap-5 px-5 py-5">
          <View className="gap-1 border-b border-border-primary pb-4">
            <AppText weight="bold" className="text-sm text-text-primary">
              Development preview � Synthetic data
            </AppText>
            <AppText className="text-xs leading-5 text-text-secondary">
              No real business data or API requests. Retry restores the
              populated demo.
            </AppText>
          </View>
          <AnalyticsChoiceChips
            label="Preview state"
            options={OPTIONS}
            value={scenario}
            onChange={setScenario}
          />
          <AnalyticsPeerComparisons
            report={
              scenario === "loading"
                ? undefined
                : peerPreviewReport(period, scenario)
            }
            loading={scenario === "loading"}
            period={period}
            onPeriodChange={setPeriod}
            retry={() => setScenario("populated")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
