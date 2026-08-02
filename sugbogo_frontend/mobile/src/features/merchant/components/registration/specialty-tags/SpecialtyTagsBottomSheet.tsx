import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { View } from "react-native";
import type { SpecialtyTagOption } from "@/features/merchant/types/merchantRegistration.types";
import SpecialtyTagsSheetHeader from "./SpecialtyTagsSheetHeader";
import SpecialtyTagItem from "./SpecialtyTagItem";

type SpecialtyTagsBottomSheetProps = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  tags: SpecialtyTagOption[];
  selectedTags: number[];
  onToggleTag: (tagId: number) => void;
  onClose: () => void;
};

const MAX_SPECIALTY_TAGS = 3;

/**
 * Displays the full specialty-tag selection interface in a bottom sheet.
 *
 * The component receives the current temporary selection from its parent
 * and delegates tag changes back through onToggleTag. The parent is also
 * responsible for committing the final selection when the sheet closes.
 */
export default function SpecialtyTagsBottomSheet({
  sheetRef,
  tags,
  selectedTags,
  onToggleTag,
  onClose,
}: SpecialtyTagsBottomSheetProps) {
  /**
   * Renders the dimmed backdrop behind the bottom sheet.
   */
  function renderBackdrop(props: any) {
    return (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.35}
      />
    );
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["70%"]}
      enablePanDownToClose
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
    >
      <SpecialtyTagsSheetHeader
        selectedCount={selectedTags.length}
        maxSelections={MAX_SPECIALTY_TAGS}
      />

      <BottomSheetScrollView
        contentContainerClassName="px-6 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row flex-wrap justify-center">
          {tags.map((tag) => {
            const isSelected = selectedTags.includes(tag.id);
            const isDisabled =
              !isSelected && selectedTags.length >= MAX_SPECIALTY_TAGS;

            return (
              <SpecialtyTagItem
                key={tag.id}
                tag={tag}
                isSelected={isSelected}
                isDisabled={isDisabled}
                onPress={() => onToggleTag(tag.id)}
              />
            );
          })}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
