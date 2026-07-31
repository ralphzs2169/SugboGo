import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export type SelectionOption = {
  label: string;
  value: string;
  icon?: string;
  color?: string;
};

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  title: string;
  options: SelectionOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
};

/**
 * SelectionBottomSheet provides a generic selection interface for choosing from a list of options.
 * The component manages bottom sheet presentation and dismissal while delegating the selected value
 *  back to the parent component.
 */
export default function SelectionBottomSheet({
  sheetRef,
  title,
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
        <View className="flex-row items-center justify-between border-b border-gray-100 pb-4">
          <Text className="text-lg font-bold text-gray-900">{title}</Text>

          <Pressable
            onPress={handleClose}
            className="rounded-full p-1 active:bg-gray-100"
          >
            <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
          </Pressable>
        </View>

        {/* Options */}
        <View className="pt-2">
          {options.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => handleSelect(option.value)}
              className="flex-row items-center py-4"
            >
              {option.icon && (
                <MaterialCommunityIcons
                  name={option.icon as any}
                  size={24}
                  color={option.color ?? "#1B4D3E"}
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
