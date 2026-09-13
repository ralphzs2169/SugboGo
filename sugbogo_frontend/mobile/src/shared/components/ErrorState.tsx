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
 * Compact section errors make the entire surface actionable when only one
 * recovery action is available, while larger states expose explicit actions.
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

  const hasPrimaryAction = Boolean(primaryActionTitle && onPrimaryAction);
  const hasSecondaryAction = Boolean(secondaryActionTitle && onSecondaryAction);

  const isSectionTapToRetry =
    isSection && hasPrimaryAction && !hasSecondaryAction;

  const containerClassName = isSection
    ? "mx-4 items-center rounded-card border border-border-primary px-4 py-4"
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

  const content = (
    <>
      {/* Error identity */}
      {/* <MaterialCommunityIcons
        name={icon}
        size={iconSize}
        color={theme.extends.colors.text.tertiary}
      /> */}

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

      {/* Whole-section recovery affordance */}
      {isSectionTapToRetry && (
        <View className="mt-3 flex-row items-center">
          <MaterialCommunityIcons
            name="refresh"
            size={15}
            color={theme.extends.colors.brand}
          />

          <AppText weight="semibold" className="ml-1.5 text-xs text-brand">
            Tap to {primaryActionTitle?.toLowerCase()}
          </AppText>
        </View>
      )}

      {/* Explicit recovery actions */}
      {!isSectionTapToRetry && (hasPrimaryAction || hasSecondaryAction) && (
        <View className={`flex-row gap-2 ${isSection ? "mt-3" : "mt-6"}`}>
          {hasSecondaryAction && (
            <Pressable
              onPress={onSecondaryAction}
              accessibilityRole="button"
              accessibilityLabel={secondaryActionTitle}
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

          {hasPrimaryAction && (
            <Pressable
              onPress={onPrimaryAction}
              accessibilityRole="button"
              accessibilityLabel={primaryActionTitle}
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
    </>
  );

  if (isSectionTapToRetry) {
    return (
      <Pressable
        onPress={onPrimaryAction}
        accessibilityRole="button"
        accessibilityLabel={`${title}. Tap to ${primaryActionTitle?.toLowerCase()}.`}
        className={`${containerClassName} cursor-pointer active:bg-background active:opacity-70`}
      >
        {content}
      </Pressable>
    );
  }

  return <View className={containerClassName}>{content}</View>;
}
