import { Pressable, Text, View, Keyboard } from "react-native";
import { useFormContext, useWatch } from "react-hook-form";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useRef, useState } from "react";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import SpecialtyTagsBottomSheet from "./SpecialtyTagsBottomSheet";
import useSpecialtyTags from "@/features/merchant/hooks/registration/useSpecialtyTags";
import SpecialtyTagChip from "./SpecialtyTagChip";
import TagSectionEmptyState from "./TagSectionEmptyState";
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

  const { specialtyTags, isLoading, error, refetch } = useSpecialtyTags();

  const [draftSelectedTags, setDraftSelectedTags] =
    useState<number[]>(selectedTags);

  const [visibleTagIds, setVisibleTagIds] = useState<number[]>([]);

  useEffect(() => {
    if (specialtyTags.length === 0) {
      setVisibleTagIds([]);
      return;
    }

    setVisibleTagIds(specialtyTags.slice(0, 10).map((tag) => tag.id));
  }, [specialtyTags]);
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
    Keyboard.dismiss();
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
      {error ? (
        <TagSectionEmptyState
          message="Unable to load specialty tags. Please try again."
          onRetry={refetch}
        />
      ) : (
        <>
          {/* Visible specialty tags */}
          <View className="mb-2 flex-row flex-wrap border-b border-border-primary pb-4">
            {visibleTagIds.map((tagId) => {
              const tag = specialtyTags.find(
                (specialtyTag) => specialtyTag.id === tagId,
              );

              if (!tag) {
                return null;
              }

              const isSelected = selectedTags.includes(tag.id);
              const isDisabled = !isSelected && selectedTags.length >= 3;

              return (
                <SpecialtyTagChip
                  key={tag.id}
                  tag={tag}
                  isSelected={isSelected}
                  isDisabled={isDisabled}
                  onPress={() => handleVisibleTagPress(tag.id)}
                  showCheckIcon
                />
              );
            })}
          </View>

          {/* Selection count and browse action */}
          <View className="mt-1 flex-row items-center justify-between">
            <Text
              className={`text-xs ${
                errors.specialtyTags ? "text-text-error" : "text-text-secondary"
              }`}
            >
              {selectedTags.length} of 3 selected
            </Text>

            <Pressable onPress={handleOpenSheet}>
              <Text className="text-sm font-semibold text-brand">
                See all tags
              </Text>
            </Pressable>
          </View>

          {/* Validation error */}
          {errors.specialtyTags?.message && (
            <Text className="mt-1 text-xs font-medium text-text-error">
              {errors.specialtyTags.message}
            </Text>
          )}

          {/* Full specialty-tag selection sheet */}
          <SpecialtyTagsBottomSheet
            sheetRef={specialtyTagsSheetRef}
            tags={specialtyTags}
            selectedTags={draftSelectedTags}
            onToggleTag={handleDraftToggle}
            onClose={handleSheetClose}
          />
        </>
      )}
    </View>
  );
}
