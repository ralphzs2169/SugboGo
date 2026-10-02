import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { shadows } from "@/shared/styles/shadows";

type OperatingHoursControlsProps = {
  isOpen: boolean;
  is24Hours: boolean;
  onOpenStateChange: (isOpen: boolean) => void;
  on24HoursChange: (is24Hours: boolean) => void;
};

/**
 * Controls the open or closed state and 24-hour setting for a daily schedule.
 *
 * Keeps the 24-hour option available only while the selected day is open.
 */
export default function OperatingHoursControls({
  isOpen,
  is24Hours,
  onOpenStateChange,
  on24HoursChange,
}: OperatingHoursControlsProps) {
  return (
    <View className="gap-3">
      {/* Open and closed segmented control */}
      <View className="flex-row rounded-md bg-black/5 p-1.5">
        <Pressable
          onPress={() => onOpenStateChange(true)}
          accessibilityRole="button"
          accessibilityState={{ selected: isOpen }}
          className={
            isOpen
              ? "flex-1 cursor-pointer rounded-md bg-surface px-4 py-3"
              : "flex-1 cursor-pointer rounded-md px-4 py-3 active:bg-surface/60"
          }
          style={isOpen ? shadows.subtle : undefined}
        >
          <View className="flex-row items-center justify-center gap-1.5">
            {isOpen && <View className="h-2 w-2 rounded-full bg-green-500" />}

            <AppText
              weight={isOpen ? "bold" : "medium"}
              className={
                isOpen
                  ? "text-center text-sm text-text-primary"
                  : "text-center text-sm text-text-tertiary"
              }
            >
              Open
            </AppText>
          </View>
        </Pressable>

        <Pressable
          onPress={() => onOpenStateChange(false)}
          accessibilityRole="button"
          accessibilityState={{ selected: !isOpen }}
          className={
            !isOpen
              ? "flex-1 cursor-pointer rounded-md bg-surface px-4 py-3"
              : "flex-1 cursor-pointer rounded-md px-4 py-3 active:bg-surface/60"
          }
          style={!isOpen ? shadows.subtle : undefined}
        >
          <View className="flex-row items-center justify-center gap-1.5">
            {!isOpen && <View className="h-2 w-2 rounded-full bg-gray-400" />}

            <AppText
              weight={!isOpen ? "bold" : "medium"}
              className={
                !isOpen
                  ? "text-center text-sm text-text-primary"
                  : "text-center text-sm text-text-tertiary"
              }
            >
              Closed
            </AppText>
          </View>
        </Pressable>
      </View>

      {/* 24-hour toggle */}
      {isOpen && (
        <Pressable
          onPress={() => on24HoursChange(!is24Hours)}
          accessibilityRole="switch"
          accessibilityState={{ checked: is24Hours }}
          className="cursor-pointer flex-row items-center justify-between py-2 active:opacity-70"
        >
          <View className="flex-row items-center gap-3">
            <MaterialCommunityIcons
              name="clock-time-four-outline"
              size={18}
              color={
                is24Hours
                  ? theme.extends.colors.brand
                  : theme.extends.colors.text.secondary
              }
            />

            <AppText
              weight={is24Hours ? "semibold" : "medium"}
              className={
                is24Hours ? "text-sm text-brand" : "text-sm text-text-primary"
              }
            >
              Open 24 hours
            </AppText>
          </View>

          <View
            className={
              is24Hours
                ? "h-6 w-11 justify-center rounded-full bg-brand px-0.5"
                : "h-6 w-11 justify-center rounded-full bg-border-primary px-0.5"
            }
          >
            <View
              className="h-5 w-5 rounded-full bg-white"
              style={[
                shadows.subtle,
                {
                  transform: [{ translateX: is24Hours ? 20 : 0 }],
                },
              ]}
            />
          </View>
        </Pressable>
      )}
    </View>
  );
}
