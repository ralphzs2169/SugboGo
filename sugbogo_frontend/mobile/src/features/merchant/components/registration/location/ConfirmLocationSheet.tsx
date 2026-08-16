import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "@/shared/components/Button";
import { theme } from "@/constants/theme";

type ConfirmLocationSheetProps = {
  address: string;
  isResolvingAddress: boolean;
  isConfirming: boolean;
  isWithinServiceArea: boolean;
  onConfirm: () => void;
};

/**
 * Displays the selected business location and allows the user
 * to confirm it.
 *
 * The address is resolved from the selected coordinates, while
 * the final location is only committed after confirmation.
 */
export default function ConfirmLocationSheet({
  address,
  isResolvingAddress,
  onConfirm,
  isConfirming,
  isWithinServiceArea,
}: ConfirmLocationSheetProps) {
  const hasAddress = address.trim().length > 0;

  return (
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
        {!isWithinServiceArea && (
          <View className="mt-3 flex-row items-center rounded-lg bg-red-50 px-3 py-2">
            <MaterialCommunityIcons
              name="alert-circle"
              size={16}
              color="#DC2626"
            />
            <Text className="ml-2 flex-1 text-xs font-medium text-red-600">
              This location is outside our current service area (Cebu City).
            </Text>
          </View>
        )}
        <Button
          title="Confirm Location"
          onPress={onConfirm}
          disabled={isResolvingAddress || isConfirming || !isWithinServiceArea}
          className="mt-4"
          fontClassName="font-bold"
        />
      </View>
    </SafeAreaView>
  );
}
