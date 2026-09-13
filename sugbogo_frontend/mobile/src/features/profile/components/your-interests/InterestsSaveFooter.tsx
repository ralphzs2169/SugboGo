import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

type InterestsSaveFooterProps = {
  hasChanges: boolean;
  isPending: boolean;
  onSave: () => void;
};

/**
 * Renders the persistent save action with safe-area-aware bottom spacing
 * and an indicator when the current interest draft has unsaved changes.
 */
export default function InterestsSaveFooter({
  hasChanges,
  isPending,
  onSave,
}: InterestsSaveFooterProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-t border-border-primary bg-surface px-5 pt-3"
      style={{
        paddingBottom: Math.max(insets.bottom, 16),
      }}
    >
      {/* Unsaved draft indicator */}
      {hasChanges && (
        <View className="mb-2 flex-row items-center justify-center">
          <MaterialCommunityIcons
            name="circle-small"
            size={18}
            color={theme.extends.colors.brand}
          />

          <AppText className="text-xs text-text-secondary">
            You have unsaved changes
          </AppText>
        </View>
      )}

      {/* Save action */}
      <Button
        title="Save Changes"
        onPress={onSave}
        loading={isPending}
        disabled={!hasChanges || isPending}
        rounded="full"
      />
    </View>
  );
}
