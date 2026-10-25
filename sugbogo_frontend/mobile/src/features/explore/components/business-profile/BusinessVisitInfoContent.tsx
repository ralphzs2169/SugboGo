import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
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
import { formatTime } from "../../utils/businessHours.utils";
import useBusinessHours from "../../hooks/useBusinessHours";
import { getBusinessAddressDisplay } from "../../utils/businessLocation.utils";
import BusinessVisitMapPreview from "./BusinessVisitMapPreview";
import MerchantAccessDirections from "../getting-there/MerchantAccessDirections";
import {
  normalizeBusinessWebsite,
  openBusinessWebsite,
} from "../../utils/businessProfileActions";

type Props = {
  businessId?: number;
  location: ExploreBusinessLocation | null;
  operatingHours: ExploreOperatingHours[];
  contactNumber: string;
  email: string | null;
  website: string | null;
  accessDirections?: string;
  onViewRoute?: () => void;
  onJeepneyGuide?: () => void;
  onRide?: () => void;
  isOwnBusiness: boolean;
  readOnly?: boolean;
  transportActions?: ReactNode;
};

/**
 * Displays practical visit information, transportation shortcuts, business
 * hours, and contact details for an Explorer viewing a business.
 *
 * Transportation actions use branded visual options while the weekly
 * operating schedule can be expanded inline.
 */
export default function BusinessVisitInfoContent({
  businessId,
  location,
  operatingHours,
  contactNumber,
  email,
  website,
  accessDirections,
  onViewRoute,
  onJeepneyGuide,
  onRide,
  isOwnBusiness,
  readOnly = false,
  transportActions,
}: Props) {
  const hours = useBusinessHours(operatingHours, !readOnly);
  const summary = readOnly ? null : hours;

  const [isExpanded, setIsExpanded] = useState(false);
  const [rotation] = useState(() => new Animated.Value(0));

  const { addressLine: address, cityLine } = location
    ? getBusinessAddressDisplay(location)
    : { addressLine: "", cityLine: "" };

  const currentDay = hours.currentDay;
  const websiteUrl = normalizeBusinessWebsite(website);

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
        <AppText
          accessibilityRole="header"
          weight="semibold"
          className="text-base text-text-primary"
        >
          Location
        </AppText>
        {location && (
          <BusinessVisitMapPreview
            businessId={businessId}
            location={location}
            readOnly={readOnly}
          />
        )}
        <View className="mt-3 flex-row">
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

        {/* Access context stays between the location and transport choices. */}
        <MerchantAccessDirections
          directions={accessDirections}
          presentation="inline"
        />

        {!isOwnBusiness && (
          <View className="mt-4">
            <AppText
              weight="semibold"
              className="mb-2 text-base text-text-primary"
            >
              How to get there
            </AppText>

            {transportActions ?? (
              <View className="flex-row gap-2  rounded-lg">
                <TransportAction
                  SvgIcon={MapRouteOptionIcon}
                  label="Road Route"
                  accessibilityLabel="View road route"
                  onPress={onViewRoute}
                  disabled={readOnly || !onViewRoute}
                />

                <TransportAction
                  SvgIcon={JeepneyOptionIcon}
                  label="Jeepney"
                  accessibilityLabel="Open jeepney guide"
                  onPress={onJeepneyGuide}
                  disabled={readOnly || !onJeepneyGuide}
                />

                <TransportAction
                  SvgIcon={BookRideOptionIcon}
                  label="Book a ride"
                  accessibilityLabel="Choose a ride provider"
                  onPress={onRide}
                  disabled={readOnly || !onRide}
                />
              </View>
            )}
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
            {summary?.status === "unavailable" ? (
              <AppText weight="medium" className="text-sm text-text-secondary">
                Hours unavailable
              </AppText>
            ) : summary ? (
              <>
                <AppText
                  weight="semibold"
                  className={`text-sm ${summary.isOpen ? "text-success" : "text-text-error"}`}
                >
                  {summary.isOpen ? "Open" : "Closed"}
                </AppText>
                <AppText
                  weight="medium"
                  className="mx-1 text-sm text-text-secondary"
                >
                  ·
                </AppText>
                <AppText
                  weight="medium"
                  className="text-sm text-text-secondary"
                >
                  {summary.label.replace(
                    summary.isOpen ? "Open now · " : "Closed · ",
                    "",
                  )}
                </AppText>
              </>
            ) : (
              <AppText weight="medium" className="text-sm text-text-secondary">
                Previously loaded hours
              </AppText>
            )}
          </View>

          <Pressable
            onPress={toggleHours}
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded
                ? "Hide full business hours"
                : "Show full business hours"
            }
            accessibilityState={{ expanded: isExpanded }}
            className="ml-3 min-h-12 cursor-pointer flex-row items-center active:opacity-70"
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

                let scheduleLabel = hours.is_open
                  ? "Hours not provided"
                  : "Closed";
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
                    className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1"
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
          <Pressable
            onPress={() => websiteUrl && void openBusinessWebsite(websiteUrl)}
            disabled={!websiteUrl}
            accessibilityRole={websiteUrl ? "link" : undefined}
            accessibilityLabel={
              websiteUrl ? `Open website: ${website}` : website
            }
            accessibilityHint={websiteUrl ? "Opens in your browser" : undefined}
            className="min-h-14 cursor-pointer flex-row items-center active:opacity-70"
          >
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
          </Pressable>
        )}
      </View>
    </View>
  );
}
