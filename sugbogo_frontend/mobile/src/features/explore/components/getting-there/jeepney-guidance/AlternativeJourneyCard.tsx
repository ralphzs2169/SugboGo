import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { DirectJourney } from "../../../types/directJourney.types";
import { formatJourneyDistance } from "../../../utils/directJourney.utils";
import DottedTimelineConnector from "@/shared/components/DottedTimelineConnector";

type Props = {
  journey: DirectJourney;
  optionNumber: number;
  onViewMap: (journey: DirectJourney) => void;
};

/**
 * Displays a compact alternative way to ride the same jeepney route.
 *
 * Keeps boarding, alighting, landmark context, and map access visually
 * subordinate to the recommended journey while remaining easy to compare.
 */
export default function AlternativeJourneyCard({
  journey,
  optionNumber,
  onViewMap,
}: Props) {
  const landmark = journey.landmark_context;

  return (
    <View className="rounded-xl border border-border-primary bg-surface px-4 py-3.5">
      {/* Alternative identity */}
      <View className="flex-row items-center justify-between">
        <View className="rounded-full bg-background px-2.5 py-1">
          <AppText
            weight="semibold"
            className="text-[10px] uppercase tracking-wide text-text-secondary"
          >
            Alternative {optionNumber}
          </AppText>
        </View>

        <AppText weight="semibold" className="text-xs text-text-secondary">
          {journey.jeepney_route_code}
        </AppText>
      </View>

      {/* Boarding and alighting guidance */}
      <View className="mt-4">
        {/* Boarding point */}
        <View className="flex-row">
          <View className="items-center">
            <View className="h-7 w-7 items-center justify-center rounded-full bg-background">
              <MaterialCommunityIcons
                name="map-marker-radius-outline"
                size={15}
                color={theme.extends.colors.text.secondary}
              />
            </View>

            <DottedTimelineConnector className="my-1 min-h-7 flex-1" />
          </View>

          <View className="ml-3 flex-1 pb-4">
            <AppText
              weight="semibold"
              className="text-sm leading-5 text-text-primary"
            >
              Board at {journey.boarding_transit_point.name}
            </AppText>

            <AppText className="mt-0.5 text-xs leading-4 text-text-secondary">
              {formatJourneyDistance(
                journey.explorer_to_boarding_distance_meters,
              )}{" "}
              from starting point
            </AppText>
          </View>
        </View>

        {/* Alighting point */}
        <View className="flex-row">
          <View className="items-center">
            <View className="h-7 w-7 items-center justify-center rounded-full bg-background">
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={16}
                color={theme.extends.colors.text.secondary}
              />
            </View>
          </View>

          <View className="ml-3 flex-1">
            <AppText
              weight="semibold"
              className="text-sm leading-5 text-text-primary"
            >
              Get off at {journey.alighting_transit_point.name}
            </AppText>

            <AppText className="mt-0.5 text-xs leading-4 text-text-secondary">
              {formatJourneyDistance(
                journey.alighting_to_business_distance_meters,
              )}{" "}
              from destination
            </AppText>

            {/* Nearby landmark context */}
            {landmark && (
              <View className="mt-2 flex-row items-center rounded-lg bg-brand/5 px-2.5 py-2">
                <MaterialCommunityIcons
                  name="map-marker-radius-outline"
                  size={14}
                  color={theme.extends.colors.brand}
                />

                <AppText
                  weight="medium"
                  className="ml-2 flex-1 text-xs leading-4 text-text-secondary"
                  numberOfLines={2}
                >
                  <AppText
                    weight="semibold"
                    className="text-xs text-text-primary"
                  >
                    {landmark.name}
                  </AppText>
                  {" · "}
                  {formatJourneyDistance(
                    landmark.distance_from_alighting_meters,
                  )}{" "}
                  away
                </AppText>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Map action */}
      <View className="mt-3 items-end">
        <Pressable
          onPress={() => onViewMap(journey)}
          accessibilityRole="button"
          accessibilityLabel={`View alternative ${optionNumber} on map`}
          className="min-h-10 cursor-pointer flex-row items-center justify-center rounded-lg px-2 active:opacity-60"
        >
          <MaterialCommunityIcons
            name="map-outline"
            size={16}
            color={theme.extends.colors.brand}
          />

          <AppText weight="semibold" className="ml-1.5 text-xs text-brand">
            View on map
          </AppText>

          <MaterialCommunityIcons
            name="chevron-right"
            size={16}
            color={theme.extends.colors.brand}
          />
        </Pressable>
      </View>
    </View>
  );
}
