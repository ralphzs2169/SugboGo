import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";

type Props = {
  remainingSlots: number;
  onPickImages: () => void;
  onPickDocuments: () => void;
  disabled?: boolean;
};

/** Offers accessible image and document pickers with visible capacity feedback. */
export default function EvidencePickerActions({
  remainingSlots,
  onPickImages,
  onPickDocuments,
  disabled = false,
}: Props) {
  const isDisabled = disabled || remainingSlots <= 0;

  return (
    <View>
      {/* Evidence capacity */}
      <Text className="text-xs text-text-secondary">
        {remainingSlots > 0
          ? `${remainingSlots} of 5 file slots available`
          : "Maximum of 5 files reached"}
      </Text>

      {/* Picker actions */}
      <View className="mt-3 flex-row gap-2">
        <Pressable
          onPress={onPickImages}
          disabled={isDisabled}
          accessibilityRole="button"
          className={`min-h-12 flex-1 cursor-pointer flex-row items-center justify-center rounded-xl border border-border-primary bg-surface px-3 active:opacity-70 ${
            isDisabled ? "opacity-50" : ""
          }`}
        >
          <MaterialCommunityIcons
            name="image-multiple-outline"
            size={20}
            color={theme.extends.colors.brand}
          />
          <Text className="ml-2 text-sm font-semibold text-text-primary">
            Add images
          </Text>
        </Pressable>

        <Pressable
          onPress={onPickDocuments}
          disabled={isDisabled}
          accessibilityRole="button"
          className={`min-h-12 flex-1 cursor-pointer flex-row items-center justify-center rounded-xl border border-border-primary bg-surface px-3 active:opacity-70 ${
            isDisabled ? "opacity-50" : ""
          }`}
        >
          <MaterialCommunityIcons
            name="file-document-outline"
            size={20}
            color={theme.extends.colors.brand}
          />
          <Text className="ml-2 text-sm font-semibold text-text-primary">
            Add files
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
