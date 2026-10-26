import { Pressable, Text, View, Keyboard } from "react-native";
import { useFormContext, useWatch } from "react-hook-form";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useRef, useState } from "react";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import SpecialtyTagsBottomSheet from "./SpecialtyTagsBottomSheet";
import useSpecialtyTags from "@/features/merchant/hooks/registration/useSpecialtyTags";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import TagSectionEmptyState from "./TagSectionEmptyState";

const VISIBLE_TAG_COUNT = 10;

/** Keeps selected tags visible while retaining the positions of existing chips. */
function reconcileVisibleTags(
  currentIds: number[],
  taxonomyIds: number[],
  selectedIds: number[],
) {
  const selected = taxonomyIds.filter((id) => selectedIds.includes(id));
  const limit = Math.max(VISIBLE_TAG_COUNT, selected.length);
  const retainedIds = currentIds.filter((id) => taxonomyIds.includes(id));
  const nextIds = retainedIds.length === 0 ? [...selected] : retainedIds;

  for (const id of selected) {
    if (nextIds.includes(id)) continue;
    let replaceIndex = -1;
    for (let index = nextIds.length - 1; index >= 0; index -= 1) {
      if (!selectedIds.includes(nextIds[index])) {
        replaceIndex = index;
        break;
      }
    }
    if (nextIds.length >= limit && replaceIndex !== -1) {
      nextIds[replaceIndex] = id;
    } else {
      nextIds.push(id);
    }
  }

  for (const id of taxonomyIds) {
    if (nextIds.length >= limit) break;
    if (!nextIds.includes(id)) nextIds.push(id);
  }
  for (
    let index = nextIds.length - 1;
    nextIds.length > limit && index >= 0;
    index -= 1
  ) {
    if (!selectedIds.includes(nextIds[index])) {
      nextIds.splice(index, 1);
    }
  }
  return nextIds;
}
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
    formState: { errors, disabled },
  } = useFormContext<MerchantRegistrationForm>();

  const specialtyTagsSheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (disabled) {
      specialtyTagsSheetRef.current?.dismiss();
    }
  }, [disabled]);

  const selectedTags = useWatch({
    control,
    name: "specialtyTags",
  });

  const { specialtyTags, error, refetch } = useSpecialtyTags();

  const [draftSelectedTags, setDraftSelectedTags] =
    useState<number[]>(selectedTags);

  const [visibleTagIds, setVisibleTagIds] = useState<number[]>([]);

  const nextVisibleTagIds = reconcileVisibleTags(
    visibleTagIds,
    specialtyTags.map((tag) => tag.id),
    selectedTags,
  );
  if (
    nextVisibleTagIds.length !== visibleTagIds.length ||
    nextVisibleTagIds.some((id, index) => id !== visibleTagIds[index])
  ) {
    // Adjust this component's presentation when restoration/refetch changes inputs.
    setVisibleTagIds(nextVisibleTagIds);
  }
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
   * Updates the saved specialty-tag selection from the main form.
   *
   * Clears the current validation error without immediately re-validating,
   * allowing the user to continue making their selection.
   */
  const handleTagSelection = (nextTags: number[]) => {
    if (disabled) return;
    setValue("specialtyTags", nextTags, {
      shouldDirty: true,
      shouldValidate: false,
    });

    clearErrors("specialtyTags");
  };

  /**
   * Opens the specialty-tag bottom sheet using the currently saved
   * selection as the temporary draft.
   */
  const handleOpenSheet = () => {
    if (disabled) return;
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
    if (disabled) return;
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
    if (disabled) return;
    setValue("specialtyTags", draftSelectedTags, {
      shouldDirty: true,
      shouldValidate: false,
    });

    clearErrors("specialtyTags");
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
          <View className="mb-2 flex-row flex-wrap border-b border-border-primary pb-4 gap-1">
            {visibleTagIds.map((tagId) => {
              const tag = specialtyTags.find(
                (specialtyTag) => specialtyTag.id === tagId,
              );

              if (!tag) {
                return null;
              }

              const isSelected = selectedTags.includes(tag.id);
              const isDisabled =
                disabled || (!isSelected && selectedTags.length >= 3);

              return (
                <SpecialtyTagChip
                  key={tag.id}
                  tag={tag}
                  mode="registration"
                  isSelected={isSelected}
                  isDisabled={isDisabled}
                  onPress={() => handleVisibleTagPress(tag.id)}
                  showIcon
                  size="medium"
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

            <Pressable onPress={handleOpenSheet} disabled={disabled}>
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
