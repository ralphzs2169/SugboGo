import type { ReactNode } from "react";
import { Text, View } from "react-native";

type Props = {
  title?: string;
  description?: string;
  children: ReactNode;
};

/**
 * Provides a consistent surface container for review dispute form sections.
 *
 * Keeps section titles, supporting text, spacing, and content aligned across
 * the dispute workflow.
 */
export default function ReviewDisputeSection({
  title,
  description,
  children,
}: Props) {
  return (
    <View className="mt-3 overflow-hidden rounded-md bg-surface px-4 py-5">
      {/* Section header */}
      {(title || description) && (
        <View className="mb-4 border-b border-border-primary pb-3">
          {title && (
            <Text className="text-base font-bold text-text-primary">
              {title}
            </Text>
          )}

          {description && (
            <Text className="mt-1 text-sm leading-5 text-text-secondary">
              {description}
            </Text>
          )}
        </View>
      )}

      {/* Section content */}
      {children}
    </View>
  );
}
