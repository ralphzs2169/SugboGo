import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";

type Props = {
  remainingSlots: number;
  onPickImages: () => void;
  onPickDocuments: () => void;
  disabled?: boolean;
  isPickingImages?: boolean;
  isPickingDocuments?: boolean;
};

/**
 * Provides compact image and document attachment actions for dispute evidence.
 *
 * Displays loading feedback while files are being selected and disables new
 * attachments once the evidence limit is reached.
 */
export default function EvidencePickerActions({
  remainingSlots,
  onPickImages,
  onPickDocuments,
  disabled = false,
  isPickingImages = false,
  isPickingDocuments = false,
}: Props) {
  const isPicking = isPickingImages || isPickingDocuments;
  const isDisabled = disabled || isPicking || remainingSlots <= 0;

  return (
    <View className="flex-row gap-2">
      {/* Add images */}
      <Pressable
        onPress={onPickImages}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel="Add evidence images"
        className={`min-h-11 flex-1 cursor-pointer flex-row items-center justify-center rounded-xl border border-border-primary bg-surface px-3 active:bg-surface-secondary ${
          isDisabled && !isPickingImages ? "opacity-50" : ""
        }`}
      >
        {isPickingImages ? (
          <ActivityIndicator size="small" color={theme.extends.colors.brand} />
        ) : (
          <MaterialCommunityIcons
            name="image-multiple-outline"
            size={19}
            color={theme.extends.colors.text.secondary}
          />
        )}

        <Text className="ml-2 text-sm font-semibold text-text-primary">
          {isPickingImages ? "" : "Add Photos"}
        </Text>
      </Pressable>

      {/* Add documents */}
      <Pressable
        onPress={onPickDocuments}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel="Add evidence documents"
        className={`min-h-11 flex-1 cursor-pointer flex-row items-center justify-center rounded-xl border border-border-primary bg-surface px-3 active:bg-surface-secondary ${
          isDisabled && !isPickingDocuments ? "opacity-50" : ""
        }`}
      >
        {isPickingDocuments ? (
          <ActivityIndicator size="small" color={theme.extends.colors.brand} />
        ) : (
          <MaterialCommunityIcons
            name="file-document-outline"
            size={19}
            color={theme.extends.colors.text.secondary}
          />
        )}

        <Text className="ml-2 text-sm font-semibold text-text-primary">
          {isPickingDocuments ? "" : "Add Files"}
        </Text>
      </Pressable>
    </View>
  );
}
