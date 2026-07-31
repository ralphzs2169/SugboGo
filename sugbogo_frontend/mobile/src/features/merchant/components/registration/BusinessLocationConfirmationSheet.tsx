import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "@/shared/components/Button";
import { theme } from "@/constants/theme";

type BusinessLocationConfirmationSheetProps = {
  address: string;
  isResolvingAddress: boolean;
  onConfirm: () => void;
};

/**
 * Displays the currently selected business location and provides
 * an action to confirm it.
 *
 * Shows a loading state while the address is being resolved and
 * falls back to an explanatory message when no address is available.
 * The confirmation action remains disabled until address resolution
 * is complete.
 */
export default function BusinessLocationConfirmationSheet({
  address,
  isResolvingAddress,
  onConfirm,
}: BusinessLocationConfirmationSheetProps) {
  // Determine whether a usable address was returned for the selected pin.
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
              // Show feedback while the backend resolves the selected coordinates.
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
              // Display the resolved address or explain that it can be entered manually.
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

        <Button
          title="Confirm Location"
          onPress={onConfirm}
          disabled={isResolvingAddress}
          className="mt-4"
          fontClassName="font-bold"
        />
      </View>
    </SafeAreaView>
  );
}
