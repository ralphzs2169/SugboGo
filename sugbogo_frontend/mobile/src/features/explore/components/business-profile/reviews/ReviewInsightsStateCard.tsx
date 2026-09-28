import type { ComponentProps } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type Props = {
  icon: IconName;
  title: string;
  description: string;
};

/**
 * Displays a compact informational state for Review Insights.
 *
 * Used for unavailable, insufficient-data, and refresh states across
 * Review Insights surfaces.
 */
export default function ReviewInsightsStateCard({
  icon,
  title,
  description,
}: Props) {
  return (
    <View className="rounded-xl bg-background px-4 py-3">
      {/* State icon and message */}
      <View className="flex-row items-start gap-3">
        <View className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface">
          <MaterialCommunityIcons
            name={icon}
            size={18}
            color={theme.extends.colors.text.secondary}
          />
        </View>

        <View className="min-w-0 flex-1">
          <AppText weight="semibold" className="text-sm text-text-primary">
            {title}
          </AppText>

          <AppText className="mt-1 text-xs leading-5 text-text-secondary">
            {description}
          </AppText>
        </View>
      </View>
    </View>
  );
}
