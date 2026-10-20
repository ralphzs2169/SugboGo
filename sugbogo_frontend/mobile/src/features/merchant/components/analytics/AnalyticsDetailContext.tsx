import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef, type ReactNode } from "react";
import { View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import type { PlusAnalyticsMeta } from "../../types/merchantPlusAnalytics.types";
import {
  formatAnalyticsDate,
  formatAnalyticsTimestamp,
} from "../../utils/merchantAnalytics.utils";
import AnalyticsReportSheet from "./AnalyticsReportSheet";

/** Keeps report dates and meaningful warnings visible, with detailed definitions in a modal. */
export default function AnalyticsDetailContext({
  meta,
  note,
  children,
  title = "About these numbers",
}: {
  meta: PlusAnalyticsMeta;
  note?: string;
  children?: ReactNode;
  title?: string;
}) {
  const sheetRef = useRef<BottomSheetModal>(null);
  return (
    <View className="gap-2 border-t border-border-primary/60 pt-4">
      {/* Context stays factual when only part of the report is available. */}
      <AppText className="text-small leading-5 text-text-secondary">
        {formatAnalyticsDate(meta.period.start_date)} –{" "}
        {formatAnalyticsDate(meta.period.end_date)} · Manila time.
        {!meta.coverage_verified ? " Some activity may not be recorded." : ""}
        {meta.partial_reasons.includes("current_day_incomplete")
          ? " Today is still in progress."
          : ""}
        {meta.availability === "partial"
          ? " Available figures are shown; some information may be missing."
          : ""}
      </AppText>
      <SafePressable
        onPress={() => sheetRef.current?.present()}
        accessibilityRole="button"
        accessibilityLabel="Show Plus measurement details"
        accessibilityHint={`Opens ${title.toLowerCase()}`}
        className="min-h-11 cursor-pointer flex-row items-center gap-2 self-start py-2 active:opacity-70"
      >
        <MaterialCommunityIcons
          name="information-outline"
          size={20}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />
        <AppText weight="medium" className="text-sm text-text-secondary">
          About these numbers
        </AppText>
      </SafePressable>
      {/* The shared frame keeps dismissal and safe-area behavior identical across reports. */}
      <AnalyticsReportSheet
        sheetRef={sheetRef}
        title={title}
        closeLabel="Close measurement information"
      >
        <View className="gap-5">
          {note && (
            <View className="gap-2">
              <AppText weight="semibold" className="text-sm text-text-primary">
                What these numbers mean
              </AppText>
              <AppText className="text-sm leading-6 text-text-secondary">
                {note}
              </AppText>
            </View>
          )}
          {meta.partial_reasons.includes("current_state_reporting") && (
            <AppText className="text-sm leading-6 text-text-secondary">
              Counts reflect records that still qualify today. Earlier results
              can change when reviews or vouches are removed or their status
              changes.
            </AppText>
          )}
          {children}
          <View className="gap-2 border-t border-border-primary pt-4">
            <AppText weight="semibold" className="text-sm text-text-primary">
              Reporting and availability
            </AppText>
            <AppText className="text-sm leading-6 text-text-secondary">
              Report prepared {formatAnalyticsTimestamp(meta.generated_at)} ·
              Manila time.{" "}
              {meta.data_through
                ? `Data available through ${formatAnalyticsTimestamp(meta.data_through)} · Manila time.`
                : "The latest data time could not be verified."}
            </AppText>
            {!meta.coverage_verified && (
              <AppText className="text-sm leading-6 text-text-secondary">
                Recorded activity may be incomplete. These figures do not
                establish business growth.
              </AppText>
            )}
          </View>
        </View>
      </AnalyticsReportSheet>
    </View>
  );
}
