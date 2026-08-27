import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Animated, LayoutAnimation, Pressable, Text, View } from "react-native";
import { useRef, useState } from "react";

import { theme } from "@/constants/theme";

import type {
  ExploreBusinessLocation,
  ExploreOperatingHours,
} from "../../types/exploreBusiness.types";
import {
  formatTime,
  getBusinessHoursSummary,
} from "../../utils/businessHours.utils";
import Button from "@/shared/components/Button";

type Props = {
  location: ExploreBusinessLocation;
  operatingHours: ExploreOperatingHours[];
  contactNumber: string;
  email: string | null;
  website: string | null;
  onGetDirections: () => void;
  isOwnBusiness: boolean;
};

/**
 * Displays the practical information an Explorer needs before visiting
 * a business, including its location, operating hours, and contact details.
 * The weekly schedule can be expanded inline while contact details remain
 * compact and easy to scan.
 */
export default function BusinessVisitInfoContent({
  location,
  operatingHours,
  contactNumber,
  email,
  website,
  onGetDirections,
  isOwnBusiness,
}: Props) {
  const summary = getBusinessHoursSummary(operatingHours);

  const [isExpanded, setIsExpanded] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;

  const address = location.address?.trim();
  const cityLine = [location.city, location.province]
    .filter(Boolean)
    .join(", ");

  const currentDay = new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
    })
    .toLowerCase();

  const toggleHours = () => {
    const nextExpanded = !isExpanded;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    Animated.timing(rotation, {
      toValue: nextExpanded ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();

    setIsExpanded(nextExpanded);
  };

  const chevronRotation = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View>
      {/* Location */}
      <View className="flex-row">
        <MaterialCommunityIcons
          name="map-marker-outline"
          size={19}
          color={theme.extends.colors.text.secondary}
        />

        <View className="ml-3 flex-1">
          {address && (
            <Text
              className="text-sm font-medium leading-5 text-text-primary"
              numberOfLines={2}
            >
              {address}
            </Text>
          )}

          {cityLine && (
            <Text className="text-sm leading-5 text-text-secondary">
              {cityLine}
            </Text>
          )}
        </View>
      </View>

      {/* Hours */}
      <View className="mt-4 border-t border-border-primary/60 pt-4">
        <View className="flex-row items-center">
          <MaterialCommunityIcons
            name="clock-outline"
            size={18}
            color={
              summary.isOpen
                ? theme.extends.colors.success
                : theme.extends.colors.error
            }
          />

          <View className="ml-3 flex-1 flex-row flex-wrap items-center">
            <Text
              className={`text-sm font-semibold ${
                summary.isOpen ? "text-success" : "text-text-error"
              }`}
            >
              {summary.isOpen ? "Open" : "Closed"}
            </Text>

            <Text className="mx-1 text-sm font-medium text-text-secondary">
              ·
            </Text>

            <Text className="text-sm font-medium text-text-secondary">
              {summary.label.replace(
                summary.isOpen ? "Open now · " : "Closed · ",
                "",
              )}
            </Text>
          </View>

          <Pressable
            onPress={toggleHours}
            className="ml-3 flex-row items-center cursor-pointer active:opacity-70"
          >
            <Text className="text-xs font-semibold text-brand">
              {isExpanded ? "Hide hours" : "Full hours"}
            </Text>

            <Animated.View
              style={{
                transform: [{ rotate: chevronRotation }],
              }}
            >
              <MaterialCommunityIcons
                name="chevron-down"
                size={16}
                color={theme.extends.colors.brand}
              />
            </Animated.View>
          </Pressable>
        </View>

        {/* Expanded weekly schedule */}
        {isExpanded && (
          <View className="mt-4 border-t border-border-primary/60 pt-4">
            <View className="gap-3">
              {operatingHours.map((hours) => {
                const dayKey = hours.day.toLowerCase();
                const dayLabel =
                  dayKey.charAt(0).toUpperCase() + dayKey.slice(1);

                const isToday = dayKey === currentDay;

                let scheduleLabel = "Closed";
                let scheduleClass = "text-text-secondary";

                if (hours.is_open) {
                  if (hours.is_24_hours) {
                    scheduleLabel = "Open 24 hours";
                    scheduleClass = "text-success";
                  } else if (hours.open_time && hours.close_time) {
                    scheduleLabel = `${formatTime(
                      hours.open_time,
                    )} – ${formatTime(hours.close_time)}`;
                    scheduleClass = "text-text-primary";
                  }
                }

                return (
                  <View
                    key={hours.id}
                    className="flex-row items-center justify-between"
                  >
                    {/* Day */}
                    <View className="flex-row items-center">
                      <Text
                        className={`text-sm ${
                          isToday
                            ? "font-bold text-text-primary"
                            : "font-medium text-text-secondary"
                        }`}
                      >
                        {dayLabel}
                      </Text>

                      {isToday && (
                        <View className="ml-2 rounded-full bg-brand/10 px-2 py-0.5">
                          <Text className="text-[9px] font-bold uppercase text-brand">
                            Today
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Hours */}
                    <Text className={`text-sm font-medium ${scheduleClass}`}>
                      {scheduleLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
      {/* Contact */}
      <View className="mt-4 border-t border-border-primary/60">
        {/* Phone */}
        <View className="min-h-14 flex-row items-center border-b border-border-primary/60">
          <MaterialCommunityIcons
            name="phone-outline"
            size={18}
            color={theme.extends.colors.text.secondary}
          />

          <Text className="ml-3 flex-1 text-sm text-text-primary">
            {contactNumber}
          </Text>
        </View>

        {/* Email */}
        {email && (
          <View className="min-h-14 flex-row items-center border-b border-border-primary/60">
            <MaterialCommunityIcons
              name="email-outline"
              size={18}
              color={theme.extends.colors.text.secondary}
            />

            <Text className="ml-3 flex-1 text-sm text-text-primary">
              {email}
            </Text>
          </View>
        )}

        {/* Website */}
        {website && (
          <View className="min-h-14 flex-row items-center">
            <MaterialCommunityIcons
              name="web"
              size={18}
              color={theme.extends.colors.text.secondary}
            />

            <Text
              className="ml-3 flex-1 text-sm text-text-primary"
              numberOfLines={1}
            >
              {website}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
