import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

export type SelectionOption = {
  label: string;
  value: string;
  icon?: string;
  color?: string;
};

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  title: string;
  description?: string;
  options: SelectionOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
};

/**
 * Provides a reusable bottom-sheet selection interface.
 *
 * Supports optional icons and colors for individual options while keeping
 * the component flexible for different selection fields across the app.
 */
export default function SelectionBottomSheet({
  sheetRef,
  title,
  description,
  options,
  selectedValue,
  onSelect,
}: Props) {
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
      <BottomSheetView className="px-6 pb-8">
        {/* Header */}
        <View className="border-b border-gray-100 pb-4">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 pr-4 text-lg font-bold text-gray-900">
              {title}
            </Text>

            <Pressable
              onPress={handleClose}
              className="rounded-full p-1 active:bg-gray-100"
            >
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={theme.extends.colors.text.secondary}
              />
            </Pressable>
          </View>

          {description && (
            <Text className="mt-1.5 pr-10 text-sm leading-5 text-text-secondary">
              {description}
            </Text>
          )}
        </View>

        {/* Options */}
        <View className="pt-1">
          {options.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => handleSelect(option.value)}
              className="flex-row items-center py-4"
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

              <Text
                className={`flex-1 text-base ${option.icon ? "ml-4" : ""}`}
                style={{
                  color: option.color ?? "#1F2937",
                }}
              >
                {option.label}
              </Text>

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
