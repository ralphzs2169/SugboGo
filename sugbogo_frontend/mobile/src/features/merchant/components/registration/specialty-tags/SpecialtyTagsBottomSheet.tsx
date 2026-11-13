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
import AppText from "@/shared/components/AppText";
import FilterSheetSearchInput from "@/shared/components/filters/FilterSheetSearchInput";

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
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(normalizedQuery),
  );

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
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onChange={(index) => {
        setIsOpen(index >= 0);
      }}
      onDismiss={() => {
        setIsOpen(false);
        setQuery("");
        onClose();
      }}
      backdropComponent={renderBackdrop}
    >
      <SpecialtyTagsSheetHeader
        selectedCount={selectedTags.length}
        maxSelections={MAX_SPECIALTY_TAGS}
      />

      <View className="mx-6 mb-4">
        <FilterSheetSearchInput
          query={query}
          onQueryChange={setQuery}
          placeholder="Search specialty tags"
          accessibilityLabel="Search specialty tags"
          background="surface"
        />
      </View>

      <BottomSheetScrollView
        contentContainerClassName="px-6 pb-8"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {normalizedQuery.length > 0 && visibleTags.length === 0 && (
          <AppText
            accessibilityLiveRegion="polite"
            className="text-center text-sm text-text-secondary"
          >
            No specialty tags match your search.
          </AppText>
        )}
        <View className="flex-row flex-wrap justify-center gap-2">
          {visibleTags.map((tag) => {
            const isSelected = selectedTags.includes(tag.id);
            const isDisabled =
              !isSelected && selectedTags.length >= MAX_SPECIALTY_TAGS;

            return (
              <SpecialtyTagChip
                key={tag.id}
                tag={tag}
                size="medium"
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
