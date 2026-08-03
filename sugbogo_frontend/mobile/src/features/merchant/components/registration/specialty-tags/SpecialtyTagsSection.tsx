import { Pressable, Text, View, Keyboard } from "react-native";
import { useFormContext, useWatch } from "react-hook-form";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import { SPECIALTY_TAGS } from "@/features/merchant/types/merchantRegistration.types";
import SpecialtyTagsBottomSheet from "./SpecialtyTagsBottomSheet";

/**
 * Renders the specialty-tag selection field for merchant registration.
 *
 * Displays a subset of specialty tags directly in the form while
 * providing a bottom sheet for browsing the complete tag list.
 *
 * Selections made inside the bottom sheet are kept as temporary draft
 * state and committed to the form when the sheet is dismissed.
 */
export default function SpecialtyTagsSection() {
  const {
    control,
    setValue,
    clearErrors,
    formState: { errors },
  } = useFormContext<MerchantRegistrationForm>();

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
   * Handles selection of a specialty tag from the main form.
   * Prevents selection of more than three tags and ensures that
   * newly selected tags remain visible in the main form.
   */
  const handleVisibleTagPress = (tagId: number) => {
    if (selectedTags.includes(tagId)) {
      handleTagSelection(selectedTags.filter((id) => id !== tagId));
      return;
    }

    if (selectedTags.length < 3) {
      handleTagSelection([...selectedTags, tagId]);
    }

    Keyboard.dismiss();
  };

  /**
   * Ensures newly selected tags remain visible in the main form.
   *
   * Hidden selected tags replace currently visible unselected tags
   * without unnecessarily reshuffling the existing visible tags.
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
   * Updates the saved specialty-tag selection from the main form.
   *
   * Clears the current validation error without immediately re-validating,
   * allowing the user to continue making their selection.
   */
  const handleTagSelection = (nextTags: number[]) => {
    setValue("specialtyTags", nextTags, {
      shouldDirty: true,
      shouldValidate: false,
    });

    clearErrors("specialtyTags");
    updateVisibleTags(nextTags);
  };

  /**
   * Opens the specialty-tag bottom sheet using the currently saved
   * selection as the temporary draft.
   */
  const handleOpenSheet = () => {
    setDraftSelectedTags(selectedTags);
    specialtyTagsSheetRef.current?.present();
  };

  /**
   * Toggles a specialty tag in the temporary bottom-sheet selection.
   *
   * Any interaction clears the existing validation error immediately.
   * Validation is deferred until the user attempts to continue.
   */
  const handleDraftToggle = (tagId: number) => {
    clearErrors("specialtyTags");

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
   * Commits the temporary bottom-sheet selection to the form
   * when the sheet is dismissed.
   */
  const handleSheetClose = () => {
    setValue("specialtyTags", draftSelectedTags, {
      shouldDirty: true,
      shouldValidate: false,
    });

    clearErrors("specialtyTags");
    updateVisibleTags(draftSelectedTags);
  };

  return (
    <View>
      <View className="mb-2 flex-row flex-wrap border-b border-border-primary pb-4">
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
              onPress={() => handleVisibleTagPress(tag.id)}
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
        <Text
          className={`text-xs ${
            errors.specialtyTags ? "text-text-error" : "text-text-secondary"
          }`}
        >
          {selectedTags.length} of 3 selected
        </Text>

        <Pressable onPress={handleOpenSheet}>
          <Text className="text-sm font-semibold text-brand">See all tags</Text>
        </Pressable>
      </View>

      {errors.specialtyTags?.message && (
        <Text className="mt-1 text-xs font-medium text-text-error">
          {errors.specialtyTags.message}
        </Text>
      )}

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
