import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type Props = {
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

/**
 * Displays a compact empty state for Explore homepage sections.
 *
 * Uses the same card language as section-level recovery states while keeping
 * empty content visually distinct from request failures.
 */
export default function ExploreSectionEmptyState({
  title,
  description,
  icon,
}: Props) {
  return (
    <View className="mx-4 items-center rounded-card border border-border-primary bg-surface px-4 py-8">
      {/* Empty-state icon */}
      <MaterialCommunityIcons
        name={icon}
        size={28}
        color={theme.extends.colors.text.tertiary}
      />

      {/* Empty-state message */}
      <AppText
        weight="semibold"
        className="mt-3 text-center text-sm text-text-primary"
      >
        {title}
      </AppText>

      <AppText className="mt-1 text-center text-sm leading-5 text-text-secondary">
        {description}
      </AppText>
    </View>
  );
}
