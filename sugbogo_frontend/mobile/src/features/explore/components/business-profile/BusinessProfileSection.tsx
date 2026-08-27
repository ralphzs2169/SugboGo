import type { ReactNode } from "react";
import { Text, View } from "react-native";

type Props = {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
};

/**
 * Provides a consistent titled surface container and spacing for sections
 * within the Explorer business profile.
 */
export default function BusinessProfileSection({
  title,
  icon,
  children,
}: Props) {
  return (
    <View className="mt-2 overflow-hidden rounded-md bg-surface px-4 py-5">
      {/* Section title */}
      {title && (
        <View className="mb-3 flex-row items-center justify-between border-b border-border-primary">
          <Text className="mb-3 text-base font-bold text-text-primary">
            {title}
          </Text>

          {icon && <View className="mb-3">{icon}</View>}
        </View>
      )}

      {/* Section content */}
      {children}
    </View>
  );
}
