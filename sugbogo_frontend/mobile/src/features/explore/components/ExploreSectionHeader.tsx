import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

type Props = {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
  seeAllAccessibilityLabel?: string;
};

/**
 * Displays a consistent heading for Explore homepage sections.
 *
 * Supports optional supporting copy and navigation to the full collection.
 */
export default function ExploreSectionHeader({
  title,
  subtitle,
  onSeeAll,
  seeAllAccessibilityLabel,
}: Props) {
  return (
    <View className="mb-4 flex-row items-start justify-between gap-4 px-4">
      {/* Section identity */}
      <View className="min-w-0 flex-1">
        <AppText weight="bold" className="text-xl text-text-primary">
          {title}
        </AppText>

        {subtitle && (
          <AppText className="mt-1 text-sm leading-5 text-text-secondary">
            {subtitle}
          </AppText>
        )}
      </View>

      {/* Collection navigation */}
      {onSeeAll && (
        <SafePressable
          onPress={onSeeAll}
          accessibilityRole="button"
          accessibilityLabel={seeAllAccessibilityLabel}
          hitSlop={8}
          className="cursor-pointer min-h-7 justify-center active:opacity-70"
        >
          <AppText weight="semibold" className="text-sm text-brand">
            See all
          </AppText>
        </SafePressable>
      )}
    </View>
  );
}
