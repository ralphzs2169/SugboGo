import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import FormInput from "@/shared/components/form/FormInput";
import { shadows } from "@/shared/styles/shadows";

type LandmarkPickerBottomSheetProps = {
  keyboardHeight: number;
  hasPendingLocation: boolean;
  landmarkName: string;
  canSubmit: boolean;
  landmarkRadiusLabel: string;
  onNameChange: (text: string) => void;
  onConfirm: () => void;
  landmarkNameError?: string;
};

/**
 * Displays guidance and confirmation controls for placing a custom landmark.
 *
 * Keeps landmark placement concise while remaining keyboard-safe when the
 * merchant names and confirms a selected map location.
 */
export default function LandmarkPickerBottomSheet({
  keyboardHeight,
  hasPendingLocation,
  landmarkName,
  canSubmit,
  landmarkRadiusLabel,
  onNameChange,
  onConfirm,
  landmarkNameError,
}: LandmarkPickerBottomSheetProps) {
  const insets = useSafeAreaInsets();

  const bottomPadding = keyboardHeight > 0 ? 14 : Math.max(insets.bottom, 14);

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0"
      style={{
        bottom: keyboardHeight,
      }}
    >
      <View
        className="rounded-t-3xl border-t border-border-primary bg-surface px-screen-x pt-5"
        style={[
          shadows.docked,
          {
            paddingBottom: bottomPadding,
          },
        ]}
      >
        {/* Guidance heading */}
        <View className="mb-4 flex-row items-start justify-between">
          <View className="min-w-0 flex-1 pr-5">
            <AppText
              weight="bold"
              className="text-base leading-5 text-text-primary"
            >
              {hasPendingLocation ? "Name your landmark" : "Add a landmark"}
            </AppText>

            <AppText
              className="mt-1 text-xs leading-4 text-text-secondary"
              numberOfLines={2}
            >
              {hasPendingLocation
                ? "Use a short name explorers can easily recognize"
                : `Choose a point within ${landmarkRadiusLabel} of your business`}
            </AppText>
          </View>

          <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
            <MaterialCommunityIcons
              name={
                hasPendingLocation
                  ? "map-marker-check-outline"
                  : "map-marker-plus-outline"
              }
              size={17}
              color={theme.extends.colors.text.secondary}
            />
          </View>
        </View>

        {!hasPendingLocation ? (
          /* Map placement guidance */
          <View className="flex-row items-center pb-1">
            <View className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand">
              <MaterialCommunityIcons
                name="gesture-tap"
                size={18}
                color="#FFFFFF"
              />
            </View>

            <View className="ml-3.5 min-w-0 flex-1 pr-1">
              <AppText
                weight="semibold"
                className="text-sm leading-5 text-text-primary"
              >
                Tap the highlighted area
              </AppText>

              <AppText className="mt-0.5 text-xs leading-4 text-text-secondary">
                Pick a recognizable landmark near your business.
              </AppText>
            </View>
          </View>
        ) : (
          <>
            {/* Selected location status */}
            <View className="mb-4 flex-row items-center">
              <MaterialCommunityIcons
                name="check-circle"
                size={16}
                color={theme.extends.colors.brand}
              />

              <AppText
                weight="semibold"
                className="ml-1.5 text-xs text-text-secondary"
              >
                Location selected
              </AppText>
            </View>

            {/* Landmark name */}
            <FormInput
              label="Landmark name"
              placeholder="e.g. Main Entrance"
              value={landmarkName}
              onChangeText={onNameChange}
              maxLength={50}
              error={landmarkNameError}
            />

            {/* Confirmation action */}
            <Button
              title="Add Landmark"
              onPress={onConfirm}
              disabled={!canSubmit}
              rounded="full"
              className="mt-2 py-3.5"
            />
          </>
        )}
      </View>
    </View>
  );
}
