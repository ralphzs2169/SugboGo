import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import { shadows } from "@/shared/styles/shadows";

type ConfirmLocationSheetProps = {
  address: string;
  isResolvingAddress: boolean;
  isConfirming: boolean;
  isWithinServiceArea: boolean;
  onConfirm: () => void;
};

/**
 * Displays the drafted business location above the map for confirmation.
 *
 * Presents address resolution and service-area feedback in a persistent
 * map footer while keeping confirmation unavailable for invalid locations.
 */
export default function ConfirmLocationSheet({
  address,
  isResolvingAddress,
  onConfirm,
  isConfirming,
  isWithinServiceArea,
}: ConfirmLocationSheetProps) {
  const insets = useSafeAreaInsets();

  const hasAddress = address.trim().length > 0;

  return (
    <View
      className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-border-primary bg-surface px-screen-x pt-4"
      style={[
        shadows.docked,
        {
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      {/* Location heading */}
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1">
          <AppText weight="bold" className="text-base text-text-primary">
            Business location
          </AppText>

          <AppText className="mt-0.5 text-xs text-text-secondary">
            Confirm that this is where customers can find your business.
          </AppText>
        </View>

        <View className="ml-3 h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
          <MaterialCommunityIcons
            name="store-marker-outline"
            size={19}
            color={theme.extends.colors.text.secondary}
          />
        </View>
      </View>

      {/* Selected location */}
      <View className="mt-3 rounded-2xl border border-border-primary bg-background p-3.5">
        <View className="flex-row items-start">
          <View className="h-6 w-6 shrink-0 items-center justify-center">
            <MaterialCommunityIcons
              name="map-marker"
              size={21}
              color={theme.extends.colors.text.secondary}
            />
          </View>

          <View className="ml-3 min-w-0 flex-1">
            <AppText
              weight="bold"
              className="text-[10px] uppercase tracking-wide text-text-secondary"
            >
              Selected location
            </AppText>

            <View className="mt-1 min-h-5 justify-center">
              {isResolvingAddress ? (
                <View className="flex-row items-center">
                  <ActivityIndicator
                    size="small"
                    color={theme.extends.colors.brand}
                  />

                  <AppText className="ml-2 text-sm text-text-secondary">
                    Finding this location…
                  </AppText>
                </View>
              ) : (
                <AppText
                  weight={hasAddress ? "semibold" : "regular"}
                  className={
                    hasAddress
                      ? "text-sm leading-5 text-text-primary"
                      : "text-sm leading-5 text-text-secondary"
                  }
                  numberOfLines={2}
                >
                  {hasAddress
                    ? address
                    : "We couldn't verify the address for this location."}
                </AppText>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Service-area feedback */}
      {!isResolvingAddress && !isWithinServiceArea && (
        <View className="mt-3 flex-row items-start rounded-xl bg-error px-3 py-2.5">
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={17}
            color={theme.extends.colors.error}
          />

          <AppText className="ml-2 flex-1 text-xs leading-4 text-text-error">
            This location is outside SugboGo's current business service area in
            Cebu City.
          </AppText>
        </View>
      )}

      {/* Confirmation action */}
      <Button
        title="Confirm business location"
        onPress={onConfirm}
        loading={isConfirming}
        disabled={isResolvingAddress || isConfirming || !isWithinServiceArea}
        rounded="full"
        className="mt-4 py-3.5"
      />
    </View>
  );
}
