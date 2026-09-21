import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useEffect, useState } from "react";
import { BackHandler, View } from "react-native";

import type { SpecialtyTagOption } from "@/features/merchant/types/registration/registrationOption.types";
import SpecialtyTagsSheetHeader from "./SpecialtyTagsSheetHeader";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";

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
 * Selection state and update logic are owned by the parent component.
 * The Android hardware back button dismisses the sheet when it is open.
 */
export default function SpecialtyTagsBottomSheet({
  sheetRef,
  tags,
  selectedTags,
  onToggleTag,
  onClose,
}: SpecialtyTagsBottomSheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        sheetRef.current?.dismiss();
        return true;
      },
    );

    return () => subscription.remove();
  }, [isOpen, sheetRef]);

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
      snapPoints={["70%", "85%"]}
      index={1}
      enablePanDownToClose
      onChange={(index) => {
        setIsOpen(index >= 0);
      }}
      onDismiss={() => {
        setIsOpen(false);
        onClose();
      }}
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
        <View className="flex-row flex-wrap justify-center gap-2">
          {tags.map((tag) => {
            const isSelected = selectedTags.includes(tag.id);
            const isDisabled =
              !isSelected && selectedTags.length >= MAX_SPECIALTY_TAGS;

            return (
              <SpecialtyTagChip
                key={tag.id}
                tag={tag}
                isSelected={isSelected}
                isDisabled={isDisabled}
                onPress={() => onToggleTag(tag.id)}
                mode="registration"
                showIcon
              />
            );
          })}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
