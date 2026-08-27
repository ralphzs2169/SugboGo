import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";
import Button from "@/shared/components/Button";

type ErrorStateProps = {
  title: string;
  description: string;

  size?: "default" | "small";
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;

  primaryActionTitle?: string;
  onPrimaryAction?: () => void;

  secondaryActionTitle?: string;
  onSecondaryAction?: () => void;
};

/**
 * Displays a centered error state with configurable sizing and iconography.
 *
 * The default variant is intended for full-page errors, while the small
 * variant is suited for localized errors within individual sections.
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
  const isSmall = size === "small";

  return (
    <View
      className={`flex-1 items-center justify-center ${
        isSmall ? "px-5" : "px-8"
      }`}
    >
      {/* Error icon */}
      <MaterialCommunityIcons
        name={icon}
        size={isSmall ? 48 : 88}
        color={theme.extends.colors.text.tertiary}
      />

      {/* Error message */}
      <Text
        className={`text-center font-bold text-text-primary ${
          isSmall ? "mt-3 text-lg" : "mt-6 text-2xl"
        }`}
      >
        {title}
      </Text>

      <Text
        className={`text-center text-text-secondary ${
          isSmall ? "mt-1 text-sm leading-5" : "mt-2 text-base leading-6"
        }`}
      >
        {description}
      </Text>

      {/* Recovery actions */}
      {(primaryActionTitle || secondaryActionTitle) && (
        <View className="mt-6 w-full flex-row gap-3">
          {secondaryActionTitle && onSecondaryAction && (
            <View className="flex-1">
              <Button
                title={secondaryActionTitle}
                variant="outline"
                onPress={onSecondaryAction}
                className="rounded-full"
              />
            </View>
          )}

          {primaryActionTitle && onPrimaryAction && (
            <View className="flex-1">
              <Button
                title={primaryActionTitle}
                onPress={onPrimaryAction}
                fontClassName="font-bold"
                className="rounded-full"
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
