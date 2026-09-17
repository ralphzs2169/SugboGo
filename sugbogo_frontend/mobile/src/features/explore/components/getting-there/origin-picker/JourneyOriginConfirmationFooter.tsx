import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import { shadows } from "@/shared/styles/shadows";

type Props = {
  selectedLabel?: string | null;
  isResolvingLabel: boolean;
  isRefreshingLocation: boolean;
  canConfirm: boolean;
  onUseCurrentLocation: () => void | Promise<void>;
  onConfirm: () => void;
};

/**
 * Displays the persistent starting-point controls above the journey map.
 *
 * Presents the drafted origin, current-location shortcut, and confirmation
 * action in a compact docked footer while accounting for the device safe area.
 */
export default function JourneyOriginConfirmationFooter({
  selectedLabel,
  isResolvingLabel,
  isRefreshingLocation,
  canConfirm,
  onUseCurrentLocation,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();

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
      {/* Starting-point heading */}
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1">
          <AppText weight="bold" className="text-base text-text-primary">
            Starting point
          </AppText>

          <AppText className="mt-0.5 text-xs text-text-secondary">
            Tap the map or search for a place to set your starting point.
          </AppText>
        </View>

        <View className="ml-3 h-9 w-9 items-center justify-center rounded-full bg-secondary/10">
          <MaterialCommunityIcons
            name="map-marker-path"
            size={19}
            color={theme.extends.colors.text.secondary}
          />
        </View>
      </View>

      {/* Selected location card */}
      <View className="mt-3 rounded-2xl border border-border-primary bg-background p-3.5">
        <View className="flex-row items-center">
          <View className="h-6 w-6 shrink-0 items-center justify-center rounded-xl ">
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
              {selectedLabel ? "Selected location" : "Select a location"}
            </AppText>

            <View className="mt-1 min-h-5 justify-center">
              {isResolvingLabel ? (
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
                  weight={selectedLabel ? "semibold" : "regular"}
                  className={
                    selectedLabel
                      ? "text-sm leading-5 text-text-primary"
                      : "text-sm leading-5 text-text-secondary"
                  }
                  numberOfLines={2}
                >
                  {selectedLabel ?? "Tap the map or search for a place."}
                </AppText>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Current-location shortcut */}
      <Pressable
        onPress={() => void onUseCurrentLocation()}
        disabled={isRefreshingLocation}
        accessibilityRole="button"
        accessibilityLabel="Use current location"
        accessibilityState={{
          disabled: isRefreshingLocation,
          busy: isRefreshingLocation,
        }}
        className="mt-2 min-h-11 cursor-pointer flex-row items-center justify-center rounded-xl active:bg-surface-secondary disabled:opacity-60"
      >
        {isRefreshingLocation ? (
          <ActivityIndicator size="small" color={theme.extends.colors.brand} />
        ) : (
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={18}
            color={theme.extends.colors.brand}
          />
        )}

        <AppText weight="semibold" className="ml-2 text-sm text-brand">
          Use current location
        </AppText>
      </Pressable>

      {/* Confirmation action */}
      <Button
        title="Confirm starting point"
        onPress={onConfirm}
        disabled={!canConfirm}
        rounded="full"
        className="mt-2 py-3.5"
      />
    </View>
  );
}
