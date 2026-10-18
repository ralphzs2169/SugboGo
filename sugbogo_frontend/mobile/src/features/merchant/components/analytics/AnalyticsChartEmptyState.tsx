import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

/** Provides centered chart feedback with a compact option for known zero or missing counts. */
export default function AnalyticsChartEmptyState({
  title,
  description,
  icon = "chart-timeline-variant",
  onRetry,
  compact = false,
}: {
  title: string;
  description: string;
  icon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <View
      testID="analytics-chart-empty-state"
      style={compact ? undefined : { minHeight: 196 }}
      className={`items-center justify-center px-4 ${compact ? "py-3" : "py-6"}`}
    >
      {/* Quiet chart identity and centered explanation */}
      <MaterialCommunityIcons
        accessible={false}
        name={icon}
        size={32}
        color={theme.extends.colors.text.tertiary}
      />
      <AppText
        weight="semibold"
        className="mt-3 text-center text-base text-text-primary"
      >
        {title}
      </AppText>
      <AppText className="mt-2 max-w-72 text-center text-sm leading-5 text-text-secondary">
        {description}
      </AppText>

      {/* Recovery is offered only for unavailable data, never for limited activity. */}
      {onRetry && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. Retry`}
          onPress={onRetry}
          className="mt-2 min-h-12 flex-row items-center justify-center gap-2 px-4 active:opacity-70"
        >
          <MaterialCommunityIcons
            accessible={false}
            name="refresh"
            size={18}
            color={theme.extends.colors.brand}
          />
          <AppText weight="semibold" className="text-sm text-brand">
            Retry
          </AppText>
        </Pressable>
      )}
    </View>
  );
}
