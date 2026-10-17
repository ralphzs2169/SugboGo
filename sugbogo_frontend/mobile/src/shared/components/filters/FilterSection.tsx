import type { ReactNode } from "react";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";

/** Groups filter controls under an accessible heading and optional hint. */
export default function FilterSection({
  title,
  hint,
  className = "pt-6",
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <View className={className}>
      {/* Section heading */}
      <View className="flex-row items-baseline justify-between">
        <AppText
          weight="bold"
          accessibilityRole="header"
          className="text-base text-text-primary"
        >
          {title}
        </AppText>
        {hint && (
          <AppText className="text-xs text-text-tertiary">{hint}</AppText>
        )}
      </View>
      {children}
    </View>
  );
}
