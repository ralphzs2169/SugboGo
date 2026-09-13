import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "@/shared/components/AppText";

import { theme } from "@/constants/theme";

export type SelectionOption = {
  label: string;
  value: string;
  icon?: string;
  color?: string;
};

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  title?: string;
  description?: string;
  options: SelectionOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
};

/**
 * Provides a reusable bottom-sheet selection interface.
 *
 * Supports optional titles, descriptions, icons, and colors for individual
 * options while respecting bottom safe-area spacing.
 */
export default function SelectionBottomSheet({
  sheetRef,
  title,
  description,
  options,
  selectedValue,
  onSelect,
}: Props) {
  const insets = useSafeAreaInsets();

  function handleSelect(value: string) {
    sheetRef.current?.dismiss();
    onSelect(value);
  }

  function handleClose() {
    sheetRef.current?.dismiss();
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["55%"]}
      enablePanDownToClose
      backgroundStyle={{
        backgroundColor: "white",
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: "#D1D5DB",
        width: 40,
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
        />
      )}
    >
      <BottomSheetView
        className="px-6"
        style={{
          paddingBottom: Math.max(insets.bottom, 32),
        }}
      >
        {/* Header */}
        {(title || description) && (
          <View className="border-b border-gray-100 pb-4">
            <View className="flex-row items-center justify-between">
              {title && (
                <AppText
                  weight="bold"
                  className="flex-1 pr-4 text-lg text-text-primary"
                >
                  {title}
                </AppText>
              )}

              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close selection sheet"
                className="cursor-pointer rounded-full p-1 active:bg-gray-100"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={theme.extends.colors.text.secondary}
                />
              </Pressable>
            </View>

            {description && (
              <AppText className="mt-1.5 pr-10 text-sm leading-5 text-text-secondary">
                {description}
              </AppText>
            )}
          </View>
        )}

        {/* Options */}
        <View className="pt-1">
          {options.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => handleSelect(option.value)}
              accessibilityRole="button"
              accessibilityState={{
                selected: selectedValue === option.value,
              }}
              className="cursor-pointer flex-row items-center py-4"
            >
              {option.icon && (
                <MaterialCommunityIcons
                  name={
                    option.icon as keyof typeof MaterialCommunityIcons.glyphMap
                  }
                  size={24}
                  color={theme.extends.colors.text.secondary}
                />
              )}

              <AppText
                className={`flex-1 text-base ${option.icon ? "ml-4" : ""}`}
                style={{
                  color: option.color ?? "#1F2937",
                }}
              >
                {option.label}
              </AppText>

              {selectedValue === option.value && (
                <MaterialCommunityIcons
                  name="check"
                  size={22}
                  color={option.color ?? "#1B4D3E"}
                />
              )}
            </Pressable>
          ))}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
