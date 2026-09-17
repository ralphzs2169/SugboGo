import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type {
  DirectJourney,
  DirectJourneyRouteOption,
} from "../../../types/directJourney.types";
import { formatJourneyDistance } from "../../../utils/directJourney.utils";
import AlternativeJourneyCard from "../jeepney-guidance/AlternativeJourneyCard";
import JourneyStep from "./JourneyStep";

type Props = {
  routeOption: DirectJourneyRouteOption;
  recommended?: boolean;
  onViewMap: (journey: DirectJourney) => void;
};

/**
 * Presents one backend-grouped jeepney route code and its available journeys.
 *
 * Highlights the recommended route while keeping detailed guidance and
 * alternative boarding or drop-off options independently expandable.
 */
export default function JourneyOptionCard({
  routeOption,
  recommended = false,
  onViewMap,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const journey = routeOption.recommended_journey;
  const alternatives = routeOption.alternative_journeys;

  const direction =
    `${journey.route_variant_origin.name} → ` +
    `${journey.route_variant_destination.name}`;

  const landmark = journey.landmark_context;

  const landmarkDetail = landmark
    ? `${landmark.name} · ${formatJourneyDistance(
        landmark.distance_from_alighting_meters,
      )} away`
    : undefined;

  return (
    <View className="relative rounded-card border border-border-primary bg-surface">
      {/* Recommended badge */}
      {recommended && (
        <View
          className="absolute right-3 flex-row items-center rounded-full bg-text-info/90 px-2.5 py-1"
          style={{
            top: -10,
            zIndex: 10,
            elevation: 4,
          }}
          pointerEvents="none"
        >
          <AppText
            weight="bold"
            className="text-[10px] tracking-wide text-white"
          >
            Recommended
          </AppText>
        </View>
      )}

      {/* Route-code summary */}
      <Pressable
        onPress={() => setIsExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={`${routeOption.jeepney_route_code}, ${direction}`}
        accessibilityHint={
          isExpanded ? "Collapses route guidance" : "Expands route guidance"
        }
        accessibilityState={{
          expanded: isExpanded,
        }}
        className="min-h-20 cursor-pointer flex-row items-center rounded-t-card px-4 py-4 active:bg-background"
      >
        {/* Route identifier */}
        <View className="mr-3 flex-row items-center rounded-lg bg-brand px-2.5 py-2">
          <MaterialCommunityIcons name="bus" size={15} color="#FFFFFF" />

          <AppText
            weight="superbold"
            className="ml-1.5 text-base leading-5 text-white"
          >
            {routeOption.jeepney_route_code}
          </AppText>
        </View>

        {/* Route summary */}
        <View className="min-w-0 flex-1">
          <AppText
            weight="semibold"
            className="text-sm leading-5 text-text-primary"
            numberOfLines={2}
          >
            {direction}
          </AppText>

          <AppText className="mt-0.5 text-xs text-text-secondary">
            {formatJourneyDistance(journey.approximate_ride_distance_meters)}{" "}
            ride
          </AppText>
        </View>

        {/* Expand control */}
        <MaterialCommunityIcons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={22}
          color={theme.extends.colors.text.secondary}
        />
      </Pressable>

      {/* Recommended way to ride */}
      {isExpanded && (
        <View className="border-t border-border-primary px-4 py-5">
          {/* Journey timeline */}
          <JourneyStep
            number={1}
            variant="origin"
            icon="map-marker-radius-outline"
            title={`Board at ${journey.boarding_transit_point.name}`}
            detail={`${formatJourneyDistance(
              journey.explorer_to_boarding_distance_meters,
            )} from starting point`}
          />

          <JourneyStep
            number={2}
            icon="bus"
            title={`Take ${journey.jeepney_route_code}`}
            detail={`Toward ${
              journey.route_variant_destination.name
            } · ${formatJourneyDistance(
              journey.approximate_ride_distance_meters,
            )} ride`}
          />

          <JourneyStep
            number={3}
            variant="destination"
            title={`Get off at ${journey.alighting_transit_point.name}`}
            detail={`${formatJourneyDistance(
              journey.alighting_to_business_distance_meters,
            )} from destination`}
            supportingLabel="Landmark near this stop"
            supportingText={landmarkDetail}
            supportingIcon="map-marker-radius-outline"
            isLast
          />

          {/* Map action */}
          <View className="mt-5 items-end">
            <Pressable
              onPress={() => onViewMap(journey)}
              accessibilityRole="button"
              accessibilityLabel="View guide on map"
              className="min-h-11 cursor-pointer flex-row items-center justify-center rounded-lg px-2 active:opacity-60"
            >
              <MaterialCommunityIcons
                name="map-outline"
                size={17}
                color={theme.extends.colors.brand}
              />

              <AppText weight="semibold" className="ml-1.5 text-sm text-brand">
                View guide on map
              </AppText>

              <MaterialCommunityIcons
                name="chevron-right"
                size={17}
                color={theme.extends.colors.brand}
              />
            </Pressable>
          </View>

          {/* Alternative ways within the same route code */}
          {alternatives.length > 0 && (
            <View className="mt-4 border-t border-border-primary pt-3">
              {/* Alternative-route disclosure */}
              <Pressable
                onPress={() => setShowAlternatives((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={`Other ways to ride ${routeOption.jeepney_route_code}`}
                accessibilityState={{
                  expanded: showAlternatives,
                }}
                className="min-h-12 cursor-pointer flex-row items-center rounded-xl px-2 py-2 active:bg-background"
              >
                <View className="h-8 w-8 items-center justify-center rounded-full bg-background">
                  <MaterialCommunityIcons
                    name="routes"
                    size={17}
                    color={theme.extends.colors.text.secondary}
                  />
                </View>

                <View className="ml-2.5 min-w-0 flex-1">
                  <View className="flex-row items-center">
                    <AppText
                      weight="semibold"
                      className="text-sm text-text-primary"
                    >
                      Other ways to ride {routeOption.jeepney_route_code}
                    </AppText>

                    <View className="ml-2 rounded-full bg-background px-2 py-0.5">
                      <AppText
                        weight="bold"
                        className="text-[10px] text-text-secondary"
                      >
                        {alternatives.length}
                      </AppText>
                    </View>
                  </View>

                  <AppText
                    className="mt-0.5 text-xs text-text-secondary"
                    numberOfLines={1}
                  >
                    Different boarding or drop-off points
                  </AppText>
                </View>

                <MaterialCommunityIcons
                  name={showAlternatives ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.extends.colors.text.secondary}
                />
              </Pressable>

              {/* Alternative journeys */}
              {showAlternatives && (
                <View className="mt-2 gap-3">
                  {alternatives.map((alternative, index) => (
                    <AlternativeJourneyCard
                      key={`${alternative.route_variant_id}-${alternative.boarding_transit_point.id}-${alternative.alighting_transit_point.id}`}
                      journey={alternative}
                      optionNumber={index + 1}
                      onViewMap={onViewMap}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
