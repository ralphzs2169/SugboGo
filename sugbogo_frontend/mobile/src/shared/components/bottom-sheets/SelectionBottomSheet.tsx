import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useCallback, type RefObject } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import useBottomSheetBackHandler from "@/shared/hooks/useBottomSheetBackHandler";

export type SelectionOption = {
  label: string;
  value: string;
  icon?: string;
  color?: string;
};

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  title?: string;
  description?: string;
  options: SelectionOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  snapPoints?: (string | number)[];
};

/**
 * Provides a reusable bottom-sheet selection interface.
 *
 * Supports configurable height, optional descriptions and icons,
 * a visible selected state, and scrollable content.
 */
export default function SelectionBottomSheet({
  sheetRef,
  title,
  description,
  options,
  selectedValue,
  onSelect,
  snapPoints = ["55%"],
}: Props) {
  const insets = useSafeAreaInsets();
  const backHandler = useBottomSheetBackHandler(sheetRef);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handleSelect = (value: string) => {
    sheetRef.current?.dismiss();
    onSelect(value);
  };

  const handleClose = () => {
    sheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      onChange={backHandler.onChange}
      onDismiss={backHandler.onDismiss}
      snapPoints={snapPoints}
      topInset={insets.top}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: theme.extends.colors.surface,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.disabled,
        width: 40,
      }}
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-6 pt-2"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 32),
        }}
      >
        {/* Sheet heading and close action */}
        {(title || description) && (
          <View className="border-b border-border-primary/60 pb-4">
            <View className="flex-row items-center justify-between gap-3">
              {title ? (
                <AppText
                  weight="bold"
                  accessibilityRole="header"
                  className="min-w-0 flex-1 text-lg text-text-primary"
                >
                  {title}
                </AppText>
              ) : (
                <View className="flex-1" />
              )}

              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close selection sheet"
                className="h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={23}
                  color={theme.extends.colors.text.secondary}
                  accessible={false}
                />
              </Pressable>
            </View>

            {description ? (
              <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                {description}
              </AppText>
            ) : null}
          </View>
        )}

        {/* Selectable options */}
        <View className="pt-1">
          {options.map((option, index) => {
            const selected = selectedValue === option.value;

            return (
              <Pressable
                key={option.value}
                onPress={() => handleSelect(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`min-h-14 flex-row cursor-pointer items-center gap-3 py-3 active:opacity-70 ${
                  index > 0 ? "border-t border-border-primary/60" : ""
                }`}
              >
                {option.icon ? (
                  <MaterialCommunityIcons
                    name={
                      option.icon as keyof typeof MaterialCommunityIcons.glyphMap
                    }
                    size={22}
                    color={theme.extends.colors.text.secondary}
                    accessible={false}
                  />
                ) : null}

                <AppText
                  weight={selected ? "semibold" : "medium"}
                  className="min-w-0 flex-1 text-base"
                  style={{
                    color:
                      option.color ??
                      (selected
                        ? theme.extends.colors.brand
                        : theme.extends.colors.text.primary),
                  }}
                >
                  {option.label}
                </AppText>

                {selected ? (
                  <MaterialCommunityIcons
                    name="check"
                    size={22}
                    color={option.color ?? theme.extends.colors.brand}
                    accessible={false}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
