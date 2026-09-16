import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

import type {
  DirectJourney,
  DirectJourneyRouteOption,
} from "../../types/directJourney.types";
import { formatJourneyDistance } from "../../utils/directJourney.utils";
import AlternativeJourneyCard from "./AlternativeJourneyCard";
import JourneyStep from "./JourneyStep";

type Props = {
  routeOption: DirectJourneyRouteOption;
  recommended?: boolean;
  onViewMap: (journey: DirectJourney) => void;
};

/**
 * Presents one backend-grouped jeepney route code and its ways to ride.
 *
 * The recommended journey can expand independently from its initially hidden
 * alternatives, preserving the exact order supplied by the backend.
 */
export default function JourneyOptionCard({
  routeOption,
  recommended = false,
  onViewMap,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(recommended);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const journey = routeOption.recommended_journey;
  const alternatives = routeOption.alternative_journeys;

  const direction = `${journey.route_variant_origin.name} → ${journey.route_variant_destination.name}`;
  const landmark = journey.landmark_context;
  const landmarkDetail = landmark
    ? `Near ${landmark.name} · approx. ${formatJourneyDistance(
        landmark.distance_from_alighting_meters,
      )} from the stop`
    : undefined;

  return (
    <View className="overflow-hidden rounded-card border border-border-primary bg-surface">
      {/* Route-code summary */}
      <Pressable
        onPress={() => setIsExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={`${routeOption.jeepney_route_code}, ${direction}`}
        accessibilityHint={
          isExpanded ? "Collapses route guidance" : "Expands route guidance"
        }
        accessibilityState={{ expanded: isExpanded }}
        className="min-h-20 cursor-pointer flex-row items-center px-4 py-4 active:bg-background"
      >
        <View className="mr-3 min-w-16 items-center rounded-xl bg-brand px-3 py-2">
          <AppText weight="superbold" className="text-lg text-white">
            {routeOption.jeepney_route_code}
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
            Approx.{" "}
            {formatJourneyDistance(journey.approximate_ride_distance_meters)}{" "}
            ride
          </AppText>
        </View>

        <MaterialCommunityIcons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={22}
          color={theme.extends.colors.text.secondary}
        />
      </Pressable>

      {/* Recommended way to ride */}
      {isExpanded && (
        <View className="border-t border-border-primary px-4 py-5">
          <JourneyStep
            number={1}
            variant="origin"
            title={`Board at ${journey.boarding_transit_point.name}`}
            detail={`Approx. ${formatJourneyDistance(
              journey.explorer_to_boarding_distance_meters,
            )} to boarding`}
          />

          <JourneyStep
            number={2}
            title={`Take ${journey.jeepney_route_code}`}
            detail={`Toward ${journey.route_variant_destination.name} · approx. ${formatJourneyDistance(
              journey.approximate_ride_distance_meters,
            )} ride`}
          />

          <JourneyStep
            number={3}
            variant="destination"
            title={`Get off at ${journey.alighting_transit_point.name}`}
            detail={`Approx. ${formatJourneyDistance(
              journey.alighting_to_business_distance_meters,
            )} from drop-off to destination`}
            supportingText={landmarkDetail}
            isLast
          />

          <Button
            title="View on map"
            variant="soft"
            rounded="full"
            className="mt-4 py-3"
            fontClassName="text-sm"
            icon={
              <MaterialCommunityIcons
                name="map-outline"
                size={18}
                color={theme.extends.colors.brand}
              />
            }
            onPress={() => onViewMap(journey)}
          />

          {/* Alternative ways within the same route code */}
          {alternatives.length > 0 && (
            <View className="mt-5 border-t border-border-primary pt-4">
              <Pressable
                onPress={() =>
                  setShowAlternatives((current) => !current)
                }
                accessibilityRole="button"
                accessibilityLabel={`Other ways to ride ${routeOption.jeepney_route_code}`}
                accessibilityState={{ expanded: showAlternatives }}
                className="min-h-12 cursor-pointer flex-row items-center justify-between rounded-xl px-1 active:opacity-70"
              >
                <AppText weight="bold" className="text-sm text-text-primary">
                  Other ways to ride {routeOption.jeepney_route_code} (
                  {alternatives.length})
                </AppText>

                <MaterialCommunityIcons
                  name={showAlternatives ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.extends.colors.text.secondary}
                />
              </Pressable>

              {showAlternatives && (
                <View className="mt-3 gap-3">
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
