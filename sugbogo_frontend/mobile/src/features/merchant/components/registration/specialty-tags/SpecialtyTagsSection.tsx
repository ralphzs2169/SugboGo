import { Pressable, Text, View } from "react-native";
import { useFormContext, useWatch } from "react-hook-form";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";

import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import { SPECIALTY_TAGS } from "@/features/merchant/types/merchantRegistration.types";
import SpecialtyTagsBottomSheet from "./SpecialtyTagsBottomSheet";

/**
 * Renders the specialty-tag selection field for merchant registration.
 *
 * Displays a small set of specialty tags directly in the form while
 * providing a bottom sheet for browsing the full tag list.
 *
 * Visible tags remain stable while the bottom sheet is open. Selections
 * made inside the bottom sheet are kept as temporary draft state and are
 * committed to the form when the sheet is dismissed.
 */
export default function SpecialtyTagsSection() {
  const { control, setValue } = useFormContext<MerchantRegistrationForm>();

  const specialtyTagsSheetRef = useRef<BottomSheetModal>(null);

  const selectedTags = useWatch({
    control,
    name: "specialtyTags",
  });

  const [draftSelectedTags, setDraftSelectedTags] = useState(selectedTags);

  const [visibleTagIds, setVisibleTagIds] = useState<number[]>(
    SPECIALTY_TAGS.slice(0, 10).map((tag) => tag.id),
  );

  /**
   * Ensures every selected tag is visible in the main form.
   *
   * Hidden selected tags replace unselected visible tags while
   * preserving the position of existing visible tags.
   */
  const updateVisibleTags = (selectedTagIds: number[]) => {
    setVisibleTagIds((currentIds) => {
      const nextIds = [...currentIds];

      const hiddenSelectedIds = selectedTagIds.filter(
        (id) => !nextIds.includes(id),
      );

      hiddenSelectedIds.forEach((selectedId) => {
        const replaceIndex = nextIds.findIndex(
          (id) => !selectedTagIds.includes(id),
        );

        if (replaceIndex !== -1) {
          nextIds[replaceIndex] = selectedId;
        }
      });

      return nextIds;
    });
  };

  /**
   * Opens the specialty-tag bottom sheet and initializes its
   * temporary selection from the current form value.
   */
  const handleOpenSheet = () => {
    setDraftSelectedTags(selectedTags);
    specialtyTagsSheetRef.current?.present();
  };

  /**
   * Toggles a tag in the bottom sheet's temporary selection.
   *
   * Selection is limited to exactly three tags.
   */
  const handleDraftToggle = (tagId: number) => {
    setDraftSelectedTags((current) => {
      if (current.includes(tagId)) {
        return current.filter((id) => id !== tagId);
      }

      if (current.length >= 3) {
        return current;
      }

      return [...current, tagId];
    });
  };

  /**
   * Commits the bottom sheet's temporary selection to the form
   * when the sheet is dismissed.
   */
  const handleSheetClose = () => {
    setValue("specialtyTags", draftSelectedTags, {
      shouldDirty: true,
      shouldValidate: true,
    });

    updateVisibleTags(draftSelectedTags);
  };

  return (
    <View>
      <View className="flex-row flex-wrap  mb-2 pb-4 ">
        {visibleTagIds.map((tagId) => {
          const tag = SPECIALTY_TAGS.find(
            (specialtyTag) => specialtyTag.id === tagId,
          );

          if (!tag) {
            return null;
          }

          const isSelected = selectedTags.includes(tag.id);
          const isDisabled = !isSelected && selectedTags.length >= 3;

          return (
            <Pressable
              key={tag.id}
              onPress={() => {
                if (isSelected) {
                  setValue(
                    "specialtyTags",
                    selectedTags.filter((id) => id !== tag.id),
                    {
                      shouldDirty: true,
                      shouldValidate: true,
                    },
                  );
                } else if (selectedTags.length < 3) {
                  setValue("specialtyTags", [...selectedTags, tag.id], {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }
              }}
              disabled={isDisabled}
              className={`mb-2 mr-2 rounded-full border px-3 py-2 ${
                isSelected
                  ? "border-brand bg-brand/10"
                  : "border-border-primary bg-surface"
              } ${isDisabled ? "opacity-40" : ""}`}
            >
              <Text
                className={`text-sm font-medium ${
                  isSelected ? "text-brand" : "text-text-secondary"
                }`}
              >
                {tag.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-1 flex-row items-center justify-between">
        <Text className="text-xs text-text-secondary">
          {selectedTags.length} of 3 selected
        </Text>
        <Pressable onPress={handleOpenSheet}>
          <Text className="text-sm font-semibold text-brand">See all tags</Text>
        </Pressable>
      </View>

      <SpecialtyTagsBottomSheet
        sheetRef={specialtyTagsSheetRef}
        tags={SPECIALTY_TAGS}
        selectedTags={draftSelectedTags}
        onToggleTag={handleDraftToggle}
        onClose={handleSheetClose}
      />
    </View>
  );
}
