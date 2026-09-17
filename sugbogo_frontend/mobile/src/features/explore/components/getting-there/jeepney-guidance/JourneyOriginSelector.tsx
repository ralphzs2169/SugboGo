import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

type OriginState = "current" | "selected" | "loading" | "unavailable";

type Props = {
  label: string;
  state: OriginState;
  onPress: () => void;
};

/**
 * Displays the active starting point as a compact floating journey control.
 *
 * Keeps the selected origin visible while route guidance scrolls underneath
 * and provides a dedicated action for changing or choosing the starting point.
 */
export default function JourneyOriginSelector({
  label,
  state,
  onPress,
}: Props) {
  const isSelected = state === "selected";
  const isLoading = state === "loading";
  const isUnavailable = state === "unavailable";

  const iconName = isSelected
    ? "map-marker-outline"
    : isUnavailable
      ? "map-marker-question-outline"
      : "crosshairs-gps";

  const actionTitle = isUnavailable || isLoading ? "Choose" : "Change";

  return (
    <View
      className="flex-row items-center rounded-2xl border border-border-primary bg-surface px-4 py-3"
      style={{
        shadowColor: "#000000",
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 1,
      }}
    >
      {/* Origin indicator */}
      <View className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10">
        <MaterialCommunityIcons
          name={iconName}
          size={21}
          color={theme.extends.colors.brand}
        />
      </View>

      {/* Origin information */}
      <View className="ml-3 min-w-0 flex-1">
        <AppText
          weight="bold"
          className="text-[10px] uppercase tracking-wide text-text-secondary"
        >
          Starting from
        </AppText>

        <AppText
          weight="bold"
          className="mt-0.5 text-sm leading-5 text-text-primary"
          numberOfLines={1}
        >
          {label}
        </AppText>
      </View>

      {/* Starting-point action */}
      <Button
        title={actionTitle}
        onPress={onPress}
        variant="primary"
        rounded="full"
        textWeight="bold"
        fontClassName="text-xs"
        className="ml-3 shrink-0 px-4 py-2.5"
        accessibilityLabel={
          isUnavailable || isLoading
            ? "Choose starting point"
            : "Change starting point"
        }
      />
    </View>
  );
}
