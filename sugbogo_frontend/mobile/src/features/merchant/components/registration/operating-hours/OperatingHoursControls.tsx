import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

type OperatingHoursControlsProps = {
  isOpen: boolean;
  is24Hours: boolean;
  onOpenStateChange: (isOpen: boolean) => void;
  on24HoursChange: (is24Hours: boolean) => void;
};

const pillShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 4,
  elevation: 3,
};

/**
 * Controls the open/closed state and 24-hour setting
 * for a single operating-hours schedule.
 *
 * The 24-hour option is only available when the day is open.
 */
export default function OperatingHoursControls({
  isOpen,
  is24Hours,
  onOpenStateChange,
  on24HoursChange,
}: OperatingHoursControlsProps) {
  return (
    <View className="gap-3">
      {/* Open/closed segmented control */}
      <View className="flex-row rounded-md bg-black/5 p-1.5">
        <Pressable
          className={
            isOpen
              ? "flex-1 rounded-md bg-white px-4 py-3"
              : "flex-1 rounded-md px-4 py-3"
          }
          style={isOpen ? pillShadow : undefined}
          onPress={() => onOpenStateChange(true)}
        >
          <View className="flex-row items-center justify-center gap-1.5">
            {isOpen && <View className="h-2 w-2 rounded-full bg-green-500" />}
            <Text
              className={
                isOpen
                  ? "text-center text-sm font-bold text-text-primary"
                  : "text-center text-sm font-medium text-text-tertiary"
              }
            >
              Open
            </Text>
          </View>
        </Pressable>

        <Pressable
          className={
            !isOpen
              ? "flex-1 rounded-md bg-white px-4 py-3"
              : "flex-1 rounded-md px-4 py-3"
          }
          style={!isOpen ? pillShadow : undefined}
          onPress={() => onOpenStateChange(false)}
        >
          <View className="flex-row items-center justify-center gap-1.5">
            {!isOpen && <View className="h-2 w-2 rounded-full bg-gray-400" />}
            <Text
              className={
                !isOpen
                  ? "text-center text-sm font-bold text-text-primary"
                  : "text-center text-sm font-medium text-text-tertiary"
              }
            >
              Closed
            </Text>
          </View>
        </Pressable>
      </View>

      {/* 24-hour toggle */}
      {isOpen && (
        <Pressable
          className="flex-row items-center justify-between py-2"
          onPress={() => on24HoursChange(!is24Hours)}
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

            <Text
              className={
                is24Hours
                  ? "text-sm font-semibold text-primary"
                  : "text-sm font-medium text-text-primary"
              }
            >
              Open 24 hours
            </Text>
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
              style={{
                transform: [{ translateX: is24Hours ? 20 : 0 }],
                ...pillShadow,
              }}
            />
          </View>
        </Pressable>
      )}
    </View>
  );
}
