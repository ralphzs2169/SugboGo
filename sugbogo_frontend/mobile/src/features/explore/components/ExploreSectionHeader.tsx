import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type Props = {
  title: string;
  subtitle?: string;
  titleIcon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
  onSeeAll?: () => void;
  seeAllAccessibilityLabel?: string;
};

/**
 * Displays a consistent heading for Explore homepage sections.
 *
 * Supports an optional semantic icon and an optional navigation action while
 * keeping section titles, descriptions, and actions visually aligned.
 */
export default function ExploreSectionHeader({
  title,
  subtitle,
  titleIcon,
  onSeeAll,
  seeAllAccessibilityLabel,
}: Props) {
  return (
    <View className="mb-4 flex-row items-start justify-between gap-4 px-4">
      {/* Section identity */}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center">
          {titleIcon && (
            <MaterialCommunityIcons
              name={titleIcon}
              size={22}
              color={theme.extends.colors.brand}
              style={{ marginRight: 7 }}
            />
          )}

          <AppText weight="bold" className="text-xl text-text-primary">
            {title}
          </AppText>
        </View>

        {subtitle && (
          <AppText className="mt-1 text-sm leading-5 text-text-secondary">
            {subtitle}
          </AppText>
        )}
      </View>

      {/* Section navigation */}
      {onSeeAll && (
        <Pressable
          onPress={onSeeAll}
          accessibilityRole="button"
          accessibilityLabel={seeAllAccessibilityLabel}
          hitSlop={8}
          className="min-h-7 cursor-pointer justify-center active:opacity-70"
        >
          <AppText weight="semibold" className="text-sm text-brand">
            See all
          </AppText>
        </Pressable>
      )}
    </View>
  );
}
