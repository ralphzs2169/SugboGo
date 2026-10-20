import { useState } from "react";
import { ScrollView, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AppText from "@/shared/components/AppText";
import AnalyticsChoiceChips from "../components/analytics/AnalyticsChoiceChips";
import AnalyticsBusinessRecommendations from "../components/analytics/AnalyticsBusinessRecommendations";
import {
  recommendationsPreviewReport,
  type RecommendationsPreviewScenario,
} from "./recommendationsPreview.fixtures";

const OPTIONS: { value: RecommendationsPreviewScenario; label: string }[] = [
  { value: "ready", label: "Ready" },
  { value: "activity", label: "Activity-based" },
  { value: "not_requested", label: "Not requested" },
  { value: "pending", label: "Queued" },
  { value: "running", label: "Preparing" },
  { value: "insufficient_data", label: "Insufficient" },
  { value: "partial", label: "Partial" },
  { value: "failed", label: "Failed" },
  { value: "fallback", label: "Failed with actions" },
  { value: "invalidated", label: "Outdated" },
  { value: "empty", label: "No actions" },
  { value: "unavailable", label: "Request error" },
  { value: "loading", label: "Loading" },
];

/** Preview actions change local state only; never fetch, generate, or navigate into real records. */
export default function MerchantRecommendationsPreviewScreen() {
  const [scenario, setScenario] =
    useState<RecommendationsPreviewScenario>("ready");
  const [notice, setNotice] = useState("");
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View className="gap-5 px-5 py-5">
          <View className="gap-1 border-b border-border-primary pb-4">
            <AppText weight="bold" className="text-sm text-text-primary">
              Development preview - Synthetic data
            </AppText>
            <AppText className="text-xs leading-5 text-text-secondary">
              No API, AI, or database requests. Get/Update simulates a queue;
              Check status simulates a ready result. Links show their intended
              destination here.
            </AppText>
          </View>
          <AnalyticsChoiceChips
            label="Preview state"
            options={OPTIONS}
            value={scenario}
            onChange={(value) => {
              setScenario(value);
              setNotice("");
            }}
          />
          {notice ? (
            <AppText
              accessibilityLiveRegion="polite"
              className="text-sm text-text-info"
            >
              {notice}
            </AppText>
          ) : null}
          <AnalyticsBusinessRecommendations
            report={
              scenario === "loading" || scenario === "unavailable"
                ? undefined
                : recommendationsPreviewReport("30", scenario)
            }
            loading={scenario === "loading"}
            error={
              scenario === "unavailable"
                ? new Error("Synthetic request failure")
                : null
            }
            refreshError={null}
            requesting={false}
            checking={false}
            throttled={false}
            requestRefresh={() => setScenario("pending")}
            checkStatus={() => setScenario("ready")}
            onOpenAction={(code) =>
              setNotice(
                code === "UNANSWERED_REVIEWS"
                  ? "Demo destination: Reviews - Needs reply - Oldest first"
                  : "Demo destination: Review insights",
              )
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
