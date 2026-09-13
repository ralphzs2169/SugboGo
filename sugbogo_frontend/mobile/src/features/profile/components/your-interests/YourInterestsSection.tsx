import type { ReactNode } from "react";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";

type Props = {
  title?: string;
  description?: string;
  selectedCount?: number;
  children: ReactNode;
};

/**
 * Provides a consistent surface container for sections within the Your
 * Interests screen, with optional heading, description, and selection count.
 */
export default function YourInterestsSection({
  title,
  description,
  selectedCount,
  children,
}: Props) {
  const hasHeader = title || description || selectedCount !== undefined;

  return (
    <View className="overflow-hidden rounded-md bg-surface px-4 py-5">
      {/* Optional section header */}
      {hasHeader && (
        <View className="mb-4 flex-row items-start justify-between">
          <View className="min-w-0 flex-1 pr-4">
            {title && (
              <AppText weight="bold" className="text-md text-text-primary">
                {title}
              </AppText>
            )}

            {description && (
              <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                {description}
              </AppText>
            )}
          </View>

          {selectedCount !== undefined && (
            <View className="rounded-full bg-background px-3 py-1.5">
              <AppText
                weight="semibold"
                className="text-xs text-text-secondary"
              >
                {selectedCount} selected
              </AppText>
            </View>
          )}
        </View>
      )}

      {/* Section content */}
      {children}
    </View>
  );
}
