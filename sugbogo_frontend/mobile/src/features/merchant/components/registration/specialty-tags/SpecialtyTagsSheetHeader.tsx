import { Text, View } from "react-native";

type Props = {
  selectedCount: number;
  maxSelections: number;
};

/**
 * Renders the header content for the specialty-tags bottom sheet.
 *
 * Displays the sheet title, current selection count, and
 * instructions for completing the selection.
 */
export default function SpecialtyTagsSheetHeader({
  selectedCount,
  maxSelections,
}: Props) {
  return (
    <View className="mb-4 border-b border-border-primary px-6 pb-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-bold text-text-primary">
          Specialty Tags
        </Text>

        <Text className="text-sm text-text-secondary">
          {selectedCount} of {maxSelections} selected
        </Text>
      </View>

      <Text className="mt-1 text-sm text-text-secondary">
        Select exactly {maxSelections} tags that describe your business.
      </Text>
    </View>
  );
}
