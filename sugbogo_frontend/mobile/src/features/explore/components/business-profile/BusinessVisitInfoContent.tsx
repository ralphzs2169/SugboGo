import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Animated, LayoutAnimation, Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import TransportAction from "@/features/explore/components/business-profile/TransportAction";
import JeepneyOptionIcon from "../../assets/getting-there-icons/jeep-route-option.svg";
import BookRideOptionIcon from "../../assets/getting-there-icons/book-ride-option.svg";
import MapRouteOptionIcon from "../../assets/getting-there-icons/route-map-option.svg";

import type {
  ExploreBusinessLocation,
  ExploreOperatingHours,
} from "../../types/exploreBusiness.types";
import {
  formatTime,
  getBusinessHoursSummary,
} from "../../utils/businessHours.utils";
import { getBusinessAddressDisplay } from "../../utils/businessLocation.utils";

type Props = {
  location: ExploreBusinessLocation;
  operatingHours: ExploreOperatingHours[];
  contactNumber: string;
  email: string | null;
  website: string | null;
  onViewRoute: () => void;
  onJeepneyGuide: () => void;
  onRide: () => void;
  isOwnBusiness: boolean;
};
/**
 * Displays practical visit information, transportation shortcuts, business
 * hours, and contact details for an Explorer viewing a business.
 *
 * Transportation actions use branded visual options while the weekly
 * operating schedule can be expanded inline.
 */
export default function BusinessVisitInfoContent({
  location,
  operatingHours,
  contactNumber,
  email,
  website,
  onViewRoute,
  onJeepneyGuide,
  onRide,
  isOwnBusiness,
}: Props) {
  const summary = getBusinessHoursSummary(operatingHours);

  const [isExpanded, setIsExpanded] = useState(false);
  const [rotation] = useState(() => new Animated.Value(0));

  const { addressLine: address, cityLine } =
    getBusinessAddressDisplay(location);

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
      {/* Location and transportation */}
      <View>
        <View className="flex-row">
          <MaterialCommunityIcons
            name="map-marker-outline"
            size={19}
            color={theme.extends.colors.text.secondary}
          />

          <View className="ml-3 flex-1">
            {address && (
              <AppText
                weight="medium"
                className="text-sm leading-5 text-text-primary"
                numberOfLines={2}
              >
                {address}
              </AppText>
            )}

            {cityLine && (
              <AppText className="text-sm leading-5 text-text-secondary">
                {cityLine}
              </AppText>
            )}
          </View>
        </View>

        {!isOwnBusiness && (
          <View className="mt-4">
            <AppText
              weight="semibold"
              className="mb-2 text-xs text-text-secondary"
            >
              Get there with these options
            </AppText>

            <View className="flex-row gap-2 bg-background rounded-lg">
              <TransportAction
                SvgIcon={MapRouteOptionIcon}
                label="Route"
                accessibilityLabel="View road route"
                onPress={onViewRoute}
              />

              <TransportAction
                SvgIcon={JeepneyOptionIcon}
                label="Jeepney"
                accessibilityLabel="Open jeepney guide"
                onPress={onJeepneyGuide}
              />

              <TransportAction
                SvgIcon={BookRideOptionIcon}
                label="Book a ride"
                accessibilityLabel="Choose a ride provider"
                onPress={onRide}
              />
            </View>
          </View>
        )}
      </View>

      {/* Operating hours */}
      <View className="mt-4 border-t border-border-primary/60 pt-4">
        <View className="flex-row items-center">
          <MaterialCommunityIcons
            name="clock-outline"
            size={18}
            color={theme.extends.colors.text.secondary}
          />

          <View className="ml-3 flex-1 flex-row flex-wrap items-center">
            <AppText
              weight="semibold"
              className={`text-sm ${
                summary.isOpen ? "text-success" : "text-text-error"
              }`}
            >
              {summary.isOpen ? "Open" : "Closed"}
            </AppText>

            <AppText
              weight="medium"
              className="mx-1 text-sm text-text-secondary"
            >
              ·
            </AppText>

            <AppText weight="medium" className="text-sm text-text-secondary">
              {summary.label.replace(
                summary.isOpen ? "Open now · " : "Closed · ",
                "",
              )}
            </AppText>
          </View>

          <Pressable
            onPress={toggleHours}
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded
                ? "Hide full business hours"
                : "Show full business hours"
            }
            className="ml-3 cursor-pointer flex-row items-center active:opacity-70"
          >
            <AppText weight="semibold" className="text-xs text-brand">
              {isExpanded ? "Hide hours" : "Full hours"}
            </AppText>

            <Animated.View
              style={{
                transform: [
                  {
                    rotate: chevronRotation,
                  },
                ],
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
                      <AppText
                        weight={isToday ? "bold" : "medium"}
                        className={`text-sm ${
                          isToday ? "text-text-primary" : "text-text-secondary"
                        }`}
                      >
                        {dayLabel}
                      </AppText>

                      {isToday && (
                        <View className="ml-2 rounded-full bg-brand/10 px-2 py-0.5">
                          <AppText
                            weight="bold"
                            className="text-[9px] uppercase text-brand"
                          >
                            Today
                          </AppText>
                        </View>
                      )}
                    </View>

                    {/* Hours */}
                    <AppText
                      weight="medium"
                      className={`text-sm ${scheduleClass}`}
                    >
                      {scheduleLabel}
                    </AppText>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Contact details */}
      <View className="mt-4 border-t border-border-primary/60">
        {/* Phone */}
        <View className="min-h-14 flex-row items-center border-b border-border-primary/60">
          <MaterialCommunityIcons
            name="phone-outline"
            size={18}
            color={theme.extends.colors.text.secondary}
          />

          <AppText className="ml-3 flex-1 text-sm text-text-primary">
            {contactNumber}
          </AppText>
        </View>

        {/* Email */}
        {email && (
          <View className="min-h-14 flex-row items-center border-b border-border-primary/60">
            <MaterialCommunityIcons
              name="email-outline"
              size={18}
              color={theme.extends.colors.text.secondary}
            />

            <AppText
              weight="medium"
              className="ml-3 flex-1 text-sm text-text-primary"
            >
              {email}
            </AppText>
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

            <AppText
              weight="medium"
              className="ml-3 flex-1 text-sm text-text-primary underline"
              numberOfLines={1}
            >
              {website}
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}
