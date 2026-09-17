import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { DirectJourneyMapGuidance } from "../../../../types/directJourney.types";
import { formatJourneyDistance } from "../../../../utils/directJourney.utils";

type Props = {
  journey: DirectJourneyMapGuidance;
  businessName: string;
  businessCoverPhotoUrl?: string | null;
  onBack: () => void;
};

const BUSINESS_THUMBNAIL_SIZE = 34;
const ROUTE_SECTION_BACKGROUND = "#F4F5F7";

/**
 * Displays compact destination and Jeepney route context above the map.
 *
 * Keeps destination identity visually primary while presenting the selected
 * route and approximate ride distance in a dense secondary section.
 */
export default function JeepneyRouteContextCard({
  journey,
  businessName,
  businessCoverPhotoUrl,
  onBack,
}: Props) {
  return (
    <View
      className="overflow-hidden rounded-2xl border border-border-primary bg-surface"
      style={{
        shadowColor: "#000",
        shadowOpacity: 0.14,
        shadowRadius: 10,
        shadowOffset: {
          width: 0,
          height: 4,
        },
        elevation: 4,
      }}
    >
      {/* Destination context */}
      <View className="flex-row items-center px-2.5 py-2">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="mr-1.5 h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full active:bg-surface-secondary"
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={22}
            color={theme.extends.colors.text.primary}
          />
        </Pressable>

        <View
          className="shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-primary bg-white"
          style={{
            width: BUSINESS_THUMBNAIL_SIZE,
            height: BUSINESS_THUMBNAIL_SIZE,
          }}
        >
          {businessCoverPhotoUrl ? (
            <Image
              source={{ uri: businessCoverPhotoUrl }}
              style={{
                width: "100%",
                height: "100%",
              }}
              contentFit="cover"
            />
          ) : (
            <MaterialCommunityIcons
              name="store-outline"
              size={18}
              color={theme.extends.colors.brand}
            />
          )}
        </View>

        <View className="ml-2 min-w-0 flex-1">
          <AppText
            weight="bold"
            className="text-[9px] uppercase tracking-wide text-brand"
          >
            Going to
          </AppText>

          <AppText
            weight="bold"
            className="text-sm leading-5 text-text-primary"
            numberOfLines={1}
          >
            {businessName}
          </AppText>
        </View>
      </View>

      {/* Jeepney route summary */}
      <View
        className="flex-row items-center border-t border-border-primary px-2.5 py-2"
        style={{
          backgroundColor: ROUTE_SECTION_BACKGROUND,
        }}
      >
        <View className="mr-2 shrink-0 flex-row items-center rounded-lg bg-brand px-2 py-1">
          <MaterialCommunityIcons name="bus" size={14} color="#FFFFFF" />

          <AppText weight="superbold" className="ml-1 text-xs text-white">
            {journey.jeepney_route_code}
          </AppText>
        </View>

        <View className="min-w-0 flex-1">
          <AppText
            weight="semibold"
            className="text-xs leading-4 text-text-primary"
            numberOfLines={1}
          >
            {journey.route_variant.origin.name}
            {"  →  "}
            {journey.route_variant.destination.name}
          </AppText>

          <AppText
            className="text-[10px] leading-4 text-text-secondary"
            numberOfLines={1}
          >
            Approx.{" "}
            {formatJourneyDistance(journey.ride.approximate_distance_meters)}{" "}
            ride
          </AppText>
        </View>
      </View>
    </View>
  );
}
