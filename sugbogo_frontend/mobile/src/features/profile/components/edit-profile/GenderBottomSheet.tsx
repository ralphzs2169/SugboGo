import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type Gender = "male" | "female" | "non_binary" | "prefer_not_to_say";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  selectedGender: Gender | null;
  onSelectGender: (gender: Gender) => void;
};

/**
 * GenderBottomSheet provides gender selection options.
 *
 * The component manages bottom sheet presentation and dismissal while
 * delegating the selected value back to the parent component.
 */
export function GenderBottomSheet({
  sheetRef,
  selectedGender,
  onSelectGender,
}: Props) {
  function handleSelectGender(gender: Gender) {
    sheetRef.current?.dismiss();
    onSelectGender(gender);
  }

  function handleClose() {
    sheetRef.current?.dismiss();
  }

  const genders: {
    label: string;
    value: Gender;
    icon: string;
  }[] = [
    {
      label: "Male",
      value: "male",
      icon: "gender-male",
    },
    {
      label: "Female",
      value: "female",
      icon: "gender-female",
    },
    {
      label: "Non-binary",
      value: "non_binary",
      icon: "gender-non-binary",
    },
    {
      label: "Prefer not to say",
      value: "prefer_not_to_say",
      icon: "account-question-outline",
    },
  ];

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["45%"]}
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
          <Text className="text-lg font-bold text-gray-900">Select Gender</Text>

          <Pressable
            onPress={handleClose}
            className="rounded-full p-1 active:bg-gray-100"
          >
            <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
          </Pressable>
        </View>

        {/* Options */}
        <View className="pt-2">
          {genders.map((gender) => (
            <Pressable
              key={gender.value}
              onPress={() => handleSelectGender(gender.value)}
              className="flex-row items-center py-4"
            >
              <MaterialCommunityIcons
                name={gender.icon as any}
                size={24}
                color="#1B4D3E"
              />

              <Text className="ml-4 flex-1 text-base text-gray-800">
                {gender.label}
              </Text>

              {selectedGender === gender.value && (
                <MaterialCommunityIcons
                  name="check"
                  size={22}
                  color="#1B4D3E"
                />
              )}
            </Pressable>
          ))}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
