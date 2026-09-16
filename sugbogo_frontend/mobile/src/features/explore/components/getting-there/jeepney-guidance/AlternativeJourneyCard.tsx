import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { DirectJourney } from "../../../types/directJourney.types";
import { formatJourneyDistance } from "../../../utils/directJourney.utils";

type Props = {
  journey: DirectJourney;
  optionNumber: number;
  onViewMap: (journey: DirectJourney) => void;
};

/**
 * Displays a compact secondary journey option for the same jeepney route.
 *
 * Keeps alternative boarding and drop-off choices visually subdued so they
 * remain easy to compare without competing with the recommended journey.
 */
export default function AlternativeJourneyCard({
  journey,
  optionNumber,
  onViewMap,
}: Props) {
  return (
    <View className="rounded-xl border border-border-primary bg-surface px-4 py-3.5">
      {/* Alternative heading */}
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

      {/* Boarding and drop-off summary */}
      <View className="mt-4">
        {/* Boarding point */}
        <View className="flex-row">
          <View className="items-center">
            <View className="h-7 w-7 items-center justify-center rounded-full bg-background">
              <MaterialCommunityIcons
                name="walk"
                size={15}
                color={theme.extends.colors.text.secondary}
              />
            </View>

            <View className="my-1 min-h-7 w-px flex-1 bg-border-primary" />
          </View>

          <View className="ml-3 flex-1 pb-4">
            <AppText
              weight="semibold"
              className="text-sm leading-5 text-text-primary"
            >
              Board at {journey.boarding_transit_point.name}
            </AppText>

            <AppText className="mt-0.5 text-xs leading-4 text-text-secondary">
              Approx.{" "}
              {formatJourneyDistance(
                journey.explorer_to_boarding_distance_meters,
              )}{" "}
              to boarding
            </AppText>
          </View>
        </View>

        {/* Drop-off point */}
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
              Approx.{" "}
              {formatJourneyDistance(
                journey.alighting_to_business_distance_meters,
              )}{" "}
              from drop-off to destination
            </AppText>

            {journey.landmark_context && (
              <View className="mt-1.5 flex-row items-center">
                <MaterialCommunityIcons
                  name="map-marker-radius-outline"
                  size={13}
                  color={theme.extends.colors.brand}
                />

                <AppText
                  weight="semibold"
                  className="ml-1 text-xs text-brand"
                  numberOfLines={1}
                >
                  Near {journey.landmark_context.name}
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
