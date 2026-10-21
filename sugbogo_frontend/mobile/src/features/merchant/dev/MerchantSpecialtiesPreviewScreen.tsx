import { useState } from "react";
import { ScrollView, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AppText from "@/shared/components/AppText";
import AnalyticsChoiceChips from "../components/analytics/AnalyticsChoiceChips";
import AnalyticsSpecialtyTrends from "../components/analytics/AnalyticsSpecialtyTrends";
import type { MerchantAnalyticsPeriod } from "../types/merchantAnalytics.types";
import type { MerchantBusinessSpecialty } from "../types/merchantBusinessProfile.types";
import {
  specialtyPreviewReport,
  type SpecialtyPreviewState,
} from "./specialtiesPreview.fixtures";

const OPTIONS: { value: SpecialtyPreviewState; label: string }[] = [
  { value: "populated", label: "Populated" },
  { value: "sparse", label: "Sparse" },
  { value: "zero", label: "Zero" },
  { value: "missing", label: "Missing week" },
  { value: "empty", label: "No specialties" },
  { value: "unavailable", label: "Unavailable" },
  { value: "error", label: "Request error" },
  { value: "loading", label: "Loading" },
];
const TAGS = [
  { id: 1, name: "Friendly service", icon: "thumbs_up", color: "blue" },
  { id: 2, name: "Food quality", icon: "utensils", color: "green" },
  { id: 3, name: "Atmosphere", icon: "heart", color: "purple" },
] satisfies MerchantBusinessSpecialty[];

export default function MerchantSpecialtiesPreviewScreen() {
  const [period, setPeriod] = useState<MerchantAnalyticsPeriod>("30");
  const [state, setState] = useState<SpecialtyPreviewState>("populated");
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
              No real business data or API requests. Retry restores the
              populated demo.
            </AppText>
          </View>
          <AnalyticsChoiceChips
            label="Preview state"
            options={OPTIONS}
            value={state}
            onChange={setState}
          />
          <AnalyticsSpecialtyTrends
            report={
              state === "loading" || state === "error"
                ? undefined
                : specialtyPreviewReport(period, state)
            }
            tags={TAGS}
            period={period}
            onPeriodChange={setPeriod}
            loading={state === "loading"}
            error={
              state === "error" ? new Error("Synthetic request failure") : null
            }
            retry={() => setState("populated")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
