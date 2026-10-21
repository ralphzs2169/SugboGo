import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "./AppText";

type Props = {
  title: string;
  children: ReactNode;
  icon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
  actionTitle?: string;
  actionAccessibilityLabel?: string;
  onAction?: () => void;
  variant?: "info" | "warning";
};

/** Reuses the merchant information-notice treatment with an optional recovery or navigation action. */
export default function InfoBanner({
  title,
  children,
  icon = "information-outline",
  actionTitle,
  actionAccessibilityLabel,
  onAction,
  variant = "info",
}: Props) {
  const isWarning = variant === "warning";
  return (
    <View
      className={`flex-row items-start gap-3 rounded-xl px-4 py-4 ${isWarning ? "bg-amber-50" : "bg-info"}`}
    >
      {/* Established information icon and message */}
      <View
        className={`mt-0.5 h-8 w-8 shrink-0 items-center justify-center rounded-full ${isWarning ? "bg-amber-100" : "bg-blue-100"}`}
      >
        <MaterialCommunityIcons
          accessible={false}
          name={icon}
          size={18}
          color={
            isWarning
              ? theme.extends.colors.brand
              : theme.extends.colors.text.info
          }
        />
      </View>
      <View className="min-w-0 flex-1">
        <AppText weight="semibold" className="text-sm text-text-primary">
          {title}
        </AppText>
        <View className="mt-1 gap-2">{children}</View>

        {/* Optional explicit banner action */}
        {actionTitle && onAction && (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionAccessibilityLabel ?? actionTitle}
            className="mt-1 min-h-12 cursor-pointer flex-row items-center gap-1 self-start active:opacity-70"
          >
            <AppText
              weight="semibold"
              className={`text-sm ${isWarning ? "text-text-primary" : "text-text-info"}`}
            >
              {actionTitle}
            </AppText>
            <MaterialCommunityIcons
              accessible={false}
              name="chevron-right"
              size={18}
              color={
                isWarning
                  ? theme.extends.colors.brand
                  : theme.extends.colors.text.info
              }
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}
