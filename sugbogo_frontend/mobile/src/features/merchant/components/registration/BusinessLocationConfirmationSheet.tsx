import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "@/shared/components/Button";
import SelectionBottomSheet, {
  SelectionOption,
} from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import { theme } from "@/constants/theme";
import { NearbyLandmark } from "@/shared/types/BusinessLocation.types";

type BusinessLocationConfirmationSheetProps = {
  address: string;
  isResolvingAddress: boolean;
  landmarks: NearbyLandmark[];
  isLoadingLandmarks: boolean;
  onLandmarkSelect: (landmark: NearbyLandmark) => void;
  selectedLandmark: NearbyLandmark | null;
  onConfirm: () => void;
};

/**
 * Displays the selected business location and allows the user
 * to optionally choose a nearby landmark before confirming it.
 *
 * The address and landmark suggestions are resolved from the
 * selected coordinates, while the final location is only committed
 * after the user confirms the selection.
 */
export default function BusinessLocationConfirmationSheet({
  address,
  isResolvingAddress,
  landmarks,
  isLoadingLandmarks,
  onLandmarkSelect,
  selectedLandmark,
  onConfirm,
}: BusinessLocationConfirmationSheetProps) {
  const landmarkSheetRef = useRef<BottomSheetModal>(null);

  const hasAddress = address.trim().length > 0;

  const landmarkOptions: SelectionOption[] = landmarks.map((landmark) => ({
    label: landmark.name,
    value: landmark.placeId,
    icon: "map-marker-outline",
  }));

  function handleLandmarkOptionSelect(placeId: string) {
    const landmark = landmarks.find((item) => item.placeId === placeId);

    if (!landmark) {
      return;
    }

    onLandmarkSelect(landmark);
  }

  return (
    <>
      <SafeAreaView
        edges={["bottom"]}
        className="absolute bottom-0 left-4 right-4"
      >
        <View className="mb-2 rounded-2xl bg-white p-4 shadow-lg">
          <View className="flex-row items-start">
            <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-full bg-orange-50">
              <MaterialCommunityIcons
                name="map-marker"
                size={20}
                color="#F27F0D"
              />
            </View>

            <View className="ml-3 flex-1">
              <Text className="text-sm font-bold text-text-primary">
                Selected Location
              </Text>

              {isResolvingAddress ? (
                <View className="mt-1.5 flex-row items-center">
                  <ActivityIndicator
                    size="small"
                    color={theme.extends.colors.brand}
                  />
                  <Text className="ml-2 text-sm text-text-secondary">
                    Getting address...
                  </Text>
                </View>
              ) : (
                <Text
                  numberOfLines={2}
                  className="mt-1 text-sm text-text-secondary"
                >
                  {hasAddress
                    ? address
                    : "Couldn't detect an address for this pin. You can still confirm and enter it manually."}
                </Text>
              )}
            </View>
          </View>

          {/* Optional nearby landmark selection. */}
          <Pressable
            onPress={() => landmarkSheetRef.current?.present()}
            disabled={isLoadingLandmarks || landmarks.length === 0}
            className="mt-4 rounded-xl border border-gray-200 px-4 py-3"
          >
            <View className="flex-row items-center">
              <MaterialCommunityIcons
                name="map-marker-radius-outline"
                size={20}
                color="#1B4D3E"
              />

              <View className="ml-3 flex-1">
                <Text className="text-xs text-text-secondary">
                  Nearest Landmark (Optional)
                </Text>

                {isLoadingLandmarks ? (
                  <View className="mt-1 flex-row items-center">
                    <ActivityIndicator
                      size="small"
                      color={theme.extends.colors.brand}
                    />
                    <Text className="ml-2 text-sm text-text-secondary">
                      Finding nearby landmarks...
                    </Text>
                  </View>
                ) : (
                  <Text className="mt-1 text-sm text-text-primary">
                    {selectedLandmark?.name ?? "Select a nearby landmark"}
                  </Text>
                )}
              </View>

              {!isLoadingLandmarks && landmarks.length > 0 && (
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={22}
                  color="#6B7280"
                />
              )}
            </View>
          </Pressable>

          <Button
            title="Confirm Location"
            onPress={onConfirm}
            disabled={isResolvingAddress}
            className="mt-4"
            fontClassName="font-bold"
          />
        </View>
      </SafeAreaView>

      <SelectionBottomSheet
        sheetRef={landmarkSheetRef}
        title="Nearby Landmarks"
        options={landmarkOptions}
        selectedValue={selectedLandmark?.placeId}
        onSelect={handleLandmarkOptionSelect}
      />
    </>
  );
}
