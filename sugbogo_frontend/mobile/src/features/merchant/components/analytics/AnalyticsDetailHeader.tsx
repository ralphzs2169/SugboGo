import type { ReactNode } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";

import AppText from "@/shared/components/AppText";

import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import AnalyticsPeriodSelector from "./AnalyticsPeriodSelector";

type Props = {
  title: string;
  description: string;
  period?: MerchantAnalyticsPeriod;
  onPeriodChange?: (period: MerchantAnalyticsPeriod) => void;
  accessory?: ReactNode;
  hideTitle?: boolean;
};

/**
 * Displays a compact introduction and period selector for
 * individual merchant analytics reports.
 *
 * Supports fixed navigation titles and horizontally scrollable
 * segmented controls for larger accessibility font sizes.
 */
export default function AnalyticsDetailHeader({
  title,
  description,
  period,
  onPeriodChange,
  accessory,
  hideTitle = false,
}: Props) {
  const { width, fontScale } = useWindowDimensions();

  const selectorWidth = Math.max(width - 40, 288 * Math.max(1, fontScale));

  return (
    <View className="border-b border-border-primary/60 bg-background px-5 pb-4 pt-4">
      {/* Short report introduction below the fixed navigation header */}
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          {!hideTitle && (
            <AppText
              weight="bold"
              accessibilityRole="header"
              className="text-base text-text-primary"
            >
              {title}
            </AppText>
          )}

          <AppText className="text-sm leading-5 text-text-secondary">
            {description}
          </AppText>
        </View>

        {accessory}
      </View>

      {/* Segmented reporting-period selector */}
      {period && onPeriodChange && (
        <View className="mt-4 gap-2">
          <AppText weight="medium" className="text-xs text-text-secondary">
            Reporting period
          </AppText>

          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <View style={{ width: selectorWidth }}>
              <AnalyticsPeriodSelector
                period={period}
                onChange={onPeriodChange}
              />
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export const ANALYTICS_DETAIL_DESCRIPTIONS = {
  pocket: "Recorded saves and saving accounts during the selected dates.",
  specialties: "Vouches added during these dates that still count today.",
  reviews: "Published review activity, sentiment, and your replies.",
  peers: "Your activity alongside anonymous similar businesses.",
  "review-insights": "A prepared review summary using its own review dates.",
  timing: "Recorded online profile visits by weekday and hour.",
  recommendations: "Available findings and suggestions for your business.",
} as const;
