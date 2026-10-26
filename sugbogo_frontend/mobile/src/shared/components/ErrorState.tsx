import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

type ErrorStateProps = {
  title: string;
  description: string;

  size?: "default" | "small" | "section";
  /** Centered analytics recovery card, matching chart unavailable states. */
  variant?: "default" | "analytics";
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;

  primaryActionTitle?: string;
  onPrimaryAction?: () => void;
  primaryActionTextTone?: "default" | "primary";

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
  variant = "default",
  icon = "cloud-off-outline",
  primaryActionTitle,
  onPrimaryAction,
  primaryActionTextTone = "default",
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

  if (variant === "analytics") {
    return (
      <View
        testID="analytics-error-state"
        style={{ minHeight: 184 }}
        className="items-center justify-center rounded-card border border-border-primary/60 bg-surface-muted/50 px-6 py-8"
      >
        <MaterialCommunityIcons
          name={icon}
          size={32}
          color={theme.extends.colors.text.tertiary}
          accessible={false}
        />
        <AppText
          accessibilityRole="header"
          weight="semibold"
          className="mt-3 text-center text-base text-text-primary"
        >
          {title}
        </AppText>
        <AppText className="mt-1.5 max-w-72 text-center text-sm leading-5 text-text-secondary">
          {description}
        </AppText>
        {(hasPrimaryAction || hasSecondaryAction) && (
          <View className="mt-4 flex-row flex-wrap items-center justify-center gap-2">
            {hasSecondaryAction && (
              <SafePressable
                accessibilityRole="button"
                accessibilityLabel={`${title}. ${secondaryActionTitle}`}
                onPress={onSecondaryAction}
                className="min-h-11 cursor-pointer items-center justify-center rounded-full border border-border-primary bg-surface px-4 py-2 active:opacity-70"
              >
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  {secondaryActionTitle}
                </AppText>
              </SafePressable>
            )}
            {hasPrimaryAction && (
              <SafePressable
                accessibilityRole="button"
                accessibilityLabel={`${title}. ${primaryActionTitle}`}
                onPress={onPrimaryAction}
                className="min-h-11 cursor-pointer flex-row items-center justify-center gap-2 rounded-full border border-border-primary bg-surface px-4 py-2 active:opacity-70"
              >
                <MaterialCommunityIcons
                  name="refresh"
                  size={16}
                  color={theme.extends.colors.brand}
                  accessible={false}
                />
                <AppText
                  weight="semibold"
                  className={`text-sm ${
                    primaryActionTextTone === "primary"
                      ? "text-text-primary"
                      : "text-brand"
                  }`}
                >
                  {primaryActionTitle}
                </AppText>
              </SafePressable>
            )}
          </View>
        )}
      </View>
    );
  }

  const content = (
    <>
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

          <AppText
            weight="semibold"
            className={`ml-1.5 text-xs ${
              primaryActionTextTone === "primary"
                ? "text-text-primary"
                : "text-brand"
            }`}
          >
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
                className={`${
                  primaryActionTextTone === "primary"
                    ? "text-text-primary"
                    : "text-white"
                } ${
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
