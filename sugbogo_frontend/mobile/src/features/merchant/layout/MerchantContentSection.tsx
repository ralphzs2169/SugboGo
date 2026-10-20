import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import { theme } from "@/constants/theme";

type Props = {
  title: string;
  description?: string;
  accessory?: ReactNode;
  icon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
  flushTop?: boolean;
  children: ReactNode;
};

/** Groups merchant content using the profile's full-width surfaces and narrow background gutters. */
export default function MerchantContentSection({
  title,
  description,
  accessory,
  icon,
  flushTop = false,
  children,
}: Props) {
  return (
    <View className={`${flushTop ? "" : "mt-2"} bg-surface px-5 pb-5 pt-4`}>
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
          {icon && (
            <MaterialCommunityIcons
              name={icon}
              size={21}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          )}
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
