import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";

type TagSectionEmptyStateProps = {
  /** Message describing why the tags cannot be displayed. */
  message: string;

  /** Called when the user taps the retry button. */
  onRetry: () => void;
};

/**
 * Empty state displayed when specialty tags cannot be loaded.
 *
 * Replaces the tag selection area with a friendly message and
 * retry action, allowing the user to recover without leaving
 * the registration flow.
 */
export default function TagSectionEmptyState({
  message,
  onRetry,
}: TagSectionEmptyStateProps) {
  return (
    <View className="items-center rounded-xl border border-border-primary bg-surface-secondary px-6 py-8">
      <MaterialCommunityIcons
        name="tag-off-outline"
        size={32}
        color={theme.extends.colors.text.secondary}
      />

      <Text className="mt-4 text-center text-base font-semibold text-text-primary">
        Unable to load specialty tags
      </Text>

      <Text className="mt-2 text-center text-sm leading-5 text-text-secondary">
        {message}
      </Text>

      <Pressable
        onPress={onRetry}
        className="mt-5 rounded-lg bg-brand px-5 py-2.5"
      >
        <Text className="font-semibold text-white">Retry</Text>
      </Pressable>
    </View>
  );
}
