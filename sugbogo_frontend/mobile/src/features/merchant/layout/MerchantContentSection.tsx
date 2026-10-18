import type { ReactNode } from "react";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";

type Props = {
  title: string;
  description?: string;
  accessory?: ReactNode;
  children: ReactNode;
};

/** Groups merchant content using the profile's full-width surfaces and narrow background gutters. */
export default function MerchantContentSection({
  title,
  description,
  accessory,
  children,
}: Props) {
  return (
    <View className="mt-2 bg-surface px-5 pb-5 pt-4">
      {/* Consistent merchant section heading */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between gap-3">
          <AppText
            weight="bold"
            accessibilityRole="header"
            className="min-w-0 flex-1 text-base text-text-primary"
          >
            {title}
          </AppText>
          {accessory}
        </View>
        {description && (
          <AppText className="mt-1 text-sm leading-5 text-text-secondary">
            {description}
          </AppText>
        )}
      </View>
      {children}
    </View>
  );
}
