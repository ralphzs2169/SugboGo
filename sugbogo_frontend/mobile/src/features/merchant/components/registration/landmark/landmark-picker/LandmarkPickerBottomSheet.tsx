import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import Button from "@/shared/components/Button";
import FormInput from "@/shared/components/form/FormInput";

type LandmarkPickerBottomSheetProps = {
  keyboardHeight: number;

  hasPendingLocation: boolean;
  landmarkName: string;
  canSubmit: boolean;
  onNameChange: (text: string) => void;
  onConfirm: () => void;
  landmarkNameError?: string;
};

/**
 * Bottom sheet for creating a custom landmark.
 *
 * Before a location is selected, it instructs the merchant
 * to tap the map. Once a location has been placed, it allows
 * the merchant to name and confirm the custom landmark.
 */
export default function LandmarkPickerBottomSheet({
  keyboardHeight,
  hasPendingLocation,
  landmarkName,
  canSubmit,
  onNameChange,
  onConfirm,
  landmarkNameError,
}: LandmarkPickerBottomSheetProps) {
  return (
    <View
      className="absolute left-0 right-0"
      style={{
        bottom: keyboardHeight,
      }}
    >
      <View className="absolute bottom-0 left-0 right-0">
        <SafeAreaView edges={["bottom"]}>
          <View className="rounded-t-3xl bg-white px-4 pt-6 pb-4 shadow-lg">
            {!hasPendingLocation ? (
              <View className="flex-row items-start">
                <MaterialCommunityIcons
                  name="map-marker-plus-outline"
                  size={24}
                  color={theme.extends.colors.brand}
                  style={{ marginTop: 1 }}
                />

                <View className="ml-3 flex-1">
                  <Text className="text-base font-bold text-text-primary">
                    Tap the map to place a landmark
                  </Text>

                  <Text className="mt-1 text-sm leading-5 text-text-secondary">
                    Select a location within the highlighted 1 km radius.
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View className="flex-row items-start">
                  <MaterialCommunityIcons
                    name="map-marker-check-outline"
                    size={24}
                    color={theme.extends.colors.brand}
                    style={{ marginTop: 1 }}
                  />

                  <View className="ml-3 flex-1">
                    <Text className="text-base font-bold text-text-primary">
                      Name your landmark
                    </Text>

                    <Text className="mt-1 text-sm leading-5 text-text-secondary">
                      Give this landmark a clear name to help explorers find
                      your business.
                    </Text>
                  </View>
                </View>

                <View className="mt-5">
                  <FormInput
                    label="Landmark Name"
                    placeholder="e.g. Front Gate"
                    value={landmarkName}
                    onChangeText={onNameChange}
                    maxLength={50}
                    error={landmarkNameError}
                  />
                </View>

                <Button
                  title="Add Landmark"
                  onPress={onConfirm}
                  disabled={!canSubmit}
                  fontClassName="font-bold"
                />
              </>
            )}
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}
