import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { DirectJourney } from "../../types/directJourney.types";
import { formatJourneyDistance } from "../../utils/directJourney.utils";
import JourneyStep from "./JourneyStep";

type Props = {
  journey: DirectJourney;
  businessName: string;
  recommended?: boolean;
};

/**
 * Presents one backend-ranked direct jeepney option.
 *
 * The recommended option starts expanded while alternatives stay compact and
 * can be opened without changing their authoritative backend order.
 */
export default function JourneyOptionCard({
  journey,
  businessName,
  recommended = false,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(recommended);

  const direction = `${journey.route_variant_origin.name} → ${journey.route_variant_destination.name}`;
  const landmark = journey.landmark_context;
  const landmarkDetail = landmark
    ? `Near ${landmark.name} · approx. ${formatJourneyDistance(
        landmark.distance_from_alighting_meters,
      )} from the stop`
    : undefined;

  return (
    <View className="overflow-hidden rounded-card border border-border-primary bg-surface">
      {/* Journey summary */}
      <Pressable
        onPress={() => setIsExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={`${journey.jeepney_route_code}, ${direction}`}
        accessibilityHint={
          isExpanded ? "Collapses journey steps" : "Expands journey steps"
        }
        accessibilityState={{ expanded: isExpanded }}
        className="min-h-20 cursor-pointer flex-row items-center px-4 py-4 active:bg-background"
      >
        <View className="mr-3 min-w-16 items-center rounded-xl bg-brand px-3 py-2">
          <AppText weight="superbold" className="text-lg text-white">
            {journey.jeepney_route_code}
          </AppText>
        </View>

        <View className="flex-1">
          {recommended ? (
            <View className="mb-1 self-start rounded-full bg-info px-2 py-0.5">
              <AppText weight="bold" className="text-[10px] text-text-info">
                Recommended
              </AppText>
            </View>
          ) : null}

          <AppText
            weight="semibold"
            className="text-sm leading-5 text-text-primary"
            numberOfLines={2}
          >
            {direction}
          </AppText>

          <AppText className="mt-0.5 text-xs text-text-secondary">
            Approx. {formatJourneyDistance(
              journey.approximate_ride_distance_meters,
            )} ride
          </AppText>
        </View>

        <MaterialCommunityIcons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={22}
          color={theme.extends.colors.text.secondary}
        />
      </Pressable>

      {/* Expanded journey steps */}
      {isExpanded ? (
        <View className="border-t border-border-primary px-4 py-5">
          <JourneyStep
            number={1}
            title={`Head to ${journey.boarding_transit_point.name}`}
            detail={`Approx. ${formatJourneyDistance(
              journey.explorer_to_boarding_distance_meters,
            )} from your location`}
          />
          <JourneyStep
            number={2}
            title={`Board ${journey.jeepney_route_code}`}
            detail={`Toward ${journey.route_variant_destination.name}`}
          />
          <JourneyStep
            number={3}
            title={`Ride to ${journey.alighting_transit_point.name}`}
            detail={`Approx. ${formatJourneyDistance(
              journey.approximate_ride_distance_meters,
            )} ride along the route`}
          />
          <JourneyStep
            number={4}
            title={`Get off at ${journey.alighting_transit_point.name}`}
            detail="Use the managed Transit Point as your drop-off reference"
            supportingText={landmarkDetail}
          />
          <JourneyStep
            number={5}
            title={`Continue to ${businessName}`}
            detail={`Approx. ${formatJourneyDistance(
              journey.alighting_to_business_distance_meters,
            )} from the alighting point`}
            isLast
          />
        </View>
      ) : null}
    </View>
  );
}
