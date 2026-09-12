import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type ErrorStateProps = {
  title: string;
  description: string;

  size?: "default" | "small" | "section";
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;

  primaryActionTitle?: string;
  onPrimaryAction?: () => void;

  secondaryActionTitle?: string;
  onSecondaryAction?: () => void;
};

/**
 * Displays a reusable error state for page-level and localized failures.
 *
 * The section variant stays compact and uses lightweight inline recovery
 * controls so localized errors do not dominate the surrounding content.
 */
export default function ErrorState({
  title,
  description,
  size = "default",
  icon = "cloud-off-outline",
  primaryActionTitle,
  onPrimaryAction,
  secondaryActionTitle,
  onSecondaryAction,
}: ErrorStateProps) {
  const isDefault = size === "default";
  const isSmall = size === "small";
  const isSection = size === "section";

  const containerClassName = isSection
    ? "items-center px-4 py-4"
    : `flex-1 items-center justify-center ${isSmall ? "px-5" : "px-8"}`;

  const iconSize = isDefault ? 88 : isSmall ? 48 : 28;

  const titleClassName = isDefault
    ? "mt-6 text-2xl"
    : isSmall
      ? "mt-3 text-lg"
      : "mt-2 text-sm";

  const descriptionClassName = isDefault
    ? "mt-2 text-base leading-6"
    : isSmall
      ? "mt-1 text-sm leading-5"
      : "mt-1 text-xs leading-4";

  return (
    <View className={containerClassName}>
      {/* Error icon */}
      <MaterialCommunityIcons
        name={icon}
        size={iconSize}
        color={theme.extends.colors.text.tertiary}
      />

      {/* Error message */}
      <AppText
        weight="bold"
        className={`text-center text-text-primary ${titleClassName}`}
      >
        {title}
      </AppText>

      <AppText
        className={`max-w-72 text-center text-text-secondary ${descriptionClassName}`}
      >
        {description}
      </AppText>

      {/* Recovery actions */}
      {(primaryActionTitle || secondaryActionTitle) && (
        <View className={`flex-row gap-2 ${isSection ? "mt-3" : "mt-6"}`}>
          {secondaryActionTitle && onSecondaryAction && (
            <Pressable
              onPress={onSecondaryAction}
              accessibilityRole="button"
              className={`cursor-pointer flex-row items-center justify-center rounded-full border border-border-primary bg-surface active:opacity-70 ${
                isSection ? "px-4 py-2" : "px-5 py-3"
              }`}
            >
              <AppText
                weight="semibold"
                className={`text-text-primary ${
                  isSection ? "text-xs" : "text-sm"
                }`}
              >
                {secondaryActionTitle}
              </AppText>
            </Pressable>
          )}

          {primaryActionTitle && onPrimaryAction && (
            <Pressable
              onPress={onPrimaryAction}
              accessibilityRole="button"
              className={`cursor-pointer flex-row items-center justify-center rounded-full bg-brand active:opacity-70 ${
                isSection ? "px-4 py-2" : "px-5 py-3"
              }`}
            >
              {isSection && (
                <MaterialCommunityIcons
                  name="refresh"
                  size={15}
                  color="white"
                />
              )}

              <AppText
                weight="semibold"
                className={`text-white ${
                  isSection ? "ml-1.5 text-xs" : "text-sm"
                }`}
              >
                {primaryActionTitle}
              </AppText>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
