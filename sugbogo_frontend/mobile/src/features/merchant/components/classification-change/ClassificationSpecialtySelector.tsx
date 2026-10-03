import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { useCallback, useRef } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import type { SpecialtyTag } from "@/shared/types/specialtyTag.types";

type TagOption = SpecialtyTag & { id: number; name: string };

/** Selects up to three specialty tags in a scrollable sheet, independent of registration form state. */
export default function ClassificationSpecialtySelector({
  tags,
  selectedIds,
  onChange,
  error,
}: {
  tags: TagOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  error?: string;
}) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  function toggleTag(tagId: number) {
    if (selectedIds.includes(tagId)) {
      onChange(selectedIds.filter((id) => id !== tagId));
    } else if (selectedIds.length < 3) {
      onChange([...selectedIds, tagId]);
    }
  }

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={insets.bottom}>
        <View className="border-t border-border-primary bg-surface px-6 py-3">
          <Button title="Done" onPress={() => sheetRef.current?.dismiss()} />
        </View>
      </BottomSheetFooter>
    ),
    [insets.bottom],
  );

  return (
    <View>
      {/* Selected tags and count */}
      <AppText weight="semibold" className="text-sm text-text-primary">
        Specialty tags
      </AppText>
      <AppText className="mt-1 text-xs text-text-secondary">
        {selectedIds.length} of 3 selected
      </AppText>
      <View className="mt-3 flex-row flex-wrap">
        {selectedIds.map((id) => {
          const tag = tags.find((item) => item.id === id);
          return tag ? (
            <SpecialtyTagChip key={id} tag={tag} size="small" showIcon />
          ) : null;
        })}
      </View>
      <Pressable
        onPress={() => sheetRef.current?.present()}
        accessibilityRole="button"
        accessibilityLabel="Choose specialty tags"
        className="cursor-pointer min-h-12 items-center justify-center rounded-xl border border-border-primary bg-surface active:bg-brand/10"
      >
        <AppText weight="semibold" className="text-sm text-brand">
          Choose specialty tags
        </AppText>
      </Pressable>
      {error ? (
        <AppText className="mt-2 text-xs text-text-error">{error}</AppText>
      ) : null}

      {/* Full tag selection */}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["70%", "85%"]}
        index={1}
        enableDynamicSizing={false}
        enablePanDownToClose
        footerComponent={renderFooter}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.35}
          />
        )}
      >
        <BottomSheetView className="mb-4 border-b border-border-primary px-6 pb-3">
          <View className="flex-row items-center justify-between">
            <AppText weight="bold" className="text-xl text-text-primary">
              Specialty Tags
            </AppText>
            <AppText className="text-sm text-text-secondary">
              {selectedIds.length} of 3 selected
            </AppText>
          </View>
          <AppText className="mt-1 text-sm text-text-secondary">
            {selectedIds.length >= 3
              ? "Deselect a specialty to choose a different one."
              : "Select exactly 3 tags that describe your business."}
          </AppText>
        </BottomSheetView>
        <BottomSheetScrollView
          contentContainerClassName="px-6"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 32) }}
          enableFooterMarginAdjustment
          showsVerticalScrollIndicator={false}
          testID="classification-specialty-options"
        >
          <View className="flex-row flex-wrap justify-center gap-2">
            {tags.map((tag) => {
              const isSelected = selectedIds.includes(tag.id);
              return (
                <SpecialtyTagChip
                  key={tag.id}
                  tag={tag}
                  mode="registration"
                  isSelected={isSelected}
                  isDisabled={!isSelected && selectedIds.length >= 3}
                  onPress={() => toggleTag(tag.id)}
                  showIcon
                  showSelectionIndicator
                />
              );
            })}
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  );
}
