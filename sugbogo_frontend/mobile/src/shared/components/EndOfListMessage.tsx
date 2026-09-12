import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type Props = {
  title?: string;
  description?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
};

/**
 * Displays a lightweight end-of-list message for completed collections.
 *
 * Intended for paginated lists that have reached their final page and need
 * a subtle visual cue without competing with the primary list content.
 */
export default function EndOfListMessage({
  title = "You're all caught up",
  description = "You've reached the end of this collection.",
  icon = "check-circle-outline",
}: Props) {
  return (
    <View className="items-center px-6 py-6">
      {/* Completion icon
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={theme.extends.colors.text.tertiary}
      /> */}

      {/* Completion message */}
      <AppText
        weight="semibold"
        className="mt-2 text-center text-sm text-text-secondary"
      >
        {title}
      </AppText>

      {description && (
        <AppText className="mt-1 text-center text-xs leading-4 text-text-tertiary">
          {description}
        </AppText>
      )}
    </View>
  );
}
