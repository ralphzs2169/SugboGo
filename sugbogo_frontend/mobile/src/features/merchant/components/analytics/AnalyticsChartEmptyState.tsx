import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type Props = {
  title: string;
  description: string;
  icon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
  onRetry?: () => void;
  /** Left-aligned inline layout for known zero or missing counts. */
  compact?: boolean;
};

/** Outlined retry action shared by both layouts; 44px minimum touch target. */
function RetryButton({
  title,
  onRetry,
  className,
}: {
  title: string;
  onRetry: () => void;
  className: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. Retry`}
      onPress={onRetry}
      hitSlop={{ top: 4, bottom: 4 }}
      className={`min-h-11 flex-row items-center justify-center gap-2 rounded-full border border-border-primary bg-surface px-4 active:opacity-70 ${className}`}
    >
      <MaterialCommunityIcons
        accessible={false}
        name="refresh"
        size={16}
        color={theme.extends.colors.brand}
      />
      <AppText weight="semibold" className="text-sm text-brand">
        Retry
      </AppText>
    </Pressable>
  );
}

/** Provides chart feedback: centered for a full chart area, or a compact inline row. */
export default function AnalyticsChartEmptyState({
  title,
  description,
  icon = "chart-timeline-variant",
  onRetry,
  compact = false,
}: Props) {
  return (
    <View
      testID="analytics-chart-empty-state"
      style={compact ? undefined : { minHeight: 184 }}
      className={`rounded-card border border-border-primary/60 bg-surface-muted/50 ${
        compact
          ? "flex-row items-start gap-3 px-4 py-4"
          : "items-center justify-center px-6 py-8"
      }`}
    >
      {/* Quiet identity icon */}
      <MaterialCommunityIcons
        accessible={false}
        name={icon}
        size={compact ? 24 : 32}
        color={theme.extends.colors.text.tertiary}
      />

      {/* Explanation, with recovery only for unavailable data */}
      <View className={compact ? "min-w-0 flex-1" : "items-center"}>
        <AppText
          weight="semibold"
          className={`text-text-primary ${
            compact ? "text-sm leading-5" : "mt-3 text-center text-base"
          }`}
        >
          {title}
        </AppText>

        <AppText
          className={`text-sm leading-5 text-text-secondary ${
            compact ? "mt-0.5" : "mt-1.5 max-w-72 text-center"
          }`}
        >
          {description}
        </AppText>

        {/* Recovery is offered only for unavailable data, never for limited activity. */}
        {onRetry ? (
          <RetryButton
            title={title}
            onRetry={onRetry}
            className={compact ? "mt-3 self-start" : "mt-4"}
          />
        ) : null}
      </View>
    </View>
  );
}
