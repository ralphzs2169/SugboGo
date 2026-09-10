import { Children, type ReactNode } from "react";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";

type ProfileMenuSectionProps = {
  title?: string;
  children: ReactNode;
};

/**
 * Groups related profile menu items inside a shared surface.
 *
 * Keeps section spacing compact while preserving clear separation between
 * titled groups and their navigation items.
 */
export default function ProfileMenuSection({
  title,
  children,
}: ProfileMenuSectionProps) {
  const items = Children.toArray(children);

  return (
    <View className="mt-1.5">
      <View className="overflow-hidden rounded-md bg-surface py-2">
        {/* Section heading */}
        {title && (
          <AppText
            weight="semibold"
            className="mb-1.5 px-5 pt-2 text-sm text-text-secondary"
          >
            {title}
          </AppText>
        )}

        {/* Section items */}
        {items.map((child, index) => (
          <View key={index}>{child}</View>
        ))}
      </View>
    </View>
  );
}
