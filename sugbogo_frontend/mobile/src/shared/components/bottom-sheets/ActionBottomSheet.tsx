import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable, Text, View } from "react-native";

type ActionOption = {
  label: string;
  value: string;
  color?: string;
};

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  options: ActionOption[];
  onSelect: (value: string) => void;
};

/**
 * Provides a compact bottom sheet for contextual actions.
 *
 * Actions are presented as centered text rows with an optional destructive
 * color. A separate Cancel action closes the sheet without performing an action.
 * Safe-area padding keeps the actions clear of the device navigation bar.
 */
export default function ActionBottomSheet({
  sheetRef,
  options,
  onSelect,
}: Props) {
  const insets = useSafeAreaInsets();

  const handleSelect = (value: string) => {
    sheetRef.current?.dismiss();
    onSelect(value);
  };

  const handleCancel = () => {
    sheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      enablePanDownToClose
      enableDynamicSizing
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
        style={{
          paddingBottom: Math.max(insets.bottom, 12),
        }}
        className="gap-2 bg-background"
      >
        {/* Action options */}
        <View>
          {options.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => handleSelect(option.value)}
              className="cursor-pointer items-center bg-surface  py-3 active:opacity-60"
            >
              <Text
                className="text-base font-bold"
                style={{
                  color: option.color ?? "#1F2937",
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Cancel action */}
        <Pressable
          onPress={handleCancel}
          className=" cursor-pointer items-center rounded-lg py-4 bg-surface active:bg-gray-100"
        >
          <Text className="text-base font-semibold text-text-secondary">
            Cancel
          </Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
