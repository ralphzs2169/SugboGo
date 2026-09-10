import type { ReactNode } from "react";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";

type Props = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  showBorder?: boolean;
};

/**
 * Provides a consistent surface container for review dispute sections.
 *
 * Supports optional section titles, descriptions, trailing icons, and
 * configurable header borders while keeping section spacing consistent.
 */
export default function ReviewDisputeSection({
  title,
  description,
  icon,
  children,
  showBorder = true,
}: Props) {
  const hasHeader = title || description || icon;

  return (
    <View className="mt-2 overflow-hidden rounded-md bg-surface px-4 py-5">
      {/* Section header */}
      {hasHeader && (
        <View
          className={`mb-4  ${
            showBorder ? "border-b border-border-primary pb-3" : ""
          }`}
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              {title && (
                <AppText weight="bold" className="text-base text-text-primary">
                  {title}
                </AppText>
              )}

              {description && (
                <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                  {description}
                </AppText>
              )}
            </View>

            {icon && <View className="shrink-0">{icon}</View>}
          </View>
        </View>
      )}

      {/* Section content */}
      {children}
    </View>
  );
}
