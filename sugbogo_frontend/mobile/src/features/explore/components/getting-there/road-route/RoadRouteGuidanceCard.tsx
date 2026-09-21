import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import { shadows } from "@/shared/styles/shadows";

import { formatJourneyDistance } from "../../../utils/directJourney.utils";
import { formatRoadRouteDuration } from "../../../utils/roadRoute.utils";

type Props = {
  distanceMeters: number;
  durationSeconds: number;
  isHandoffPending: boolean;
  onContinueInGoogleMaps: () => void;
};

/**
 * Displays persistent road-route guidance below the map.
 *
 * Highlights the route distance and estimated travel time while providing
 * supporting traffic context and the primary Google Maps navigation handoff.
 */
export default function RoadRouteGuidanceCard({
  distanceMeters,
  durationSeconds,
  isHandoffPending,
  onContinueInGoogleMaps,
}: Props) {
  return (
    <View
      className="rounded-t-[28px] border-t border-border-primary bg-surface px-screen-x pb-3 pt-4"
      style={shadows.docked}
    >
      {/* Route metrics */}
      <View className="flex-row items-center">
        <View className="min-w-0 flex-1 flex-row items-center">
          <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
            <MaterialCommunityIcons
              name="map-marker-distance"
              size={19}
              color={theme.extends.colors.text.secondary}
            />
          </View>

          <View className="ml-3 min-w-0 flex-1">
            <AppText className="text-[11px] text-text-secondary">
              Distance
            </AppText>

            <AppText
              weight="extrabold"
              className="mt-0.5 text-lg leading-6 text-text-primary"
              numberOfLines={1}
            >
              {formatJourneyDistance(distanceMeters)}
            </AppText>
          </View>
        </View>

        <View className="mx-3 h-9 w-px bg-border-primary" />

        <View className="min-w-0 flex-1 flex-row items-center">
          <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
            <MaterialCommunityIcons
              name="clock-outline"
              size={19}
              color={theme.extends.colors.text.secondary}
            />
          </View>

          <View className="ml-3 min-w-0 flex-1">
            <AppText className="text-[11px] text-text-secondary">
              Estimated time
            </AppText>

            <AppText
              weight="extrabold"
              className="mt-0.5 text-lg leading-6 text-text-primary"
              numberOfLines={1}
            >
              {formatRoadRouteDuration(durationSeconds)}
            </AppText>
          </View>
        </View>
      </View>

      {/* Traffic clarification */}
      <View className="mt-3 flex-row items-start">
        <MaterialCommunityIcons
          name="information-outline"
          size={15}
          color={theme.extends.colors.text.tertiary}
        />

        <AppText className="ml-1.5 flex-1 text-[11px] leading-4 text-text-tertiary">
          Estimated time does not include live traffic.
        </AppText>
      </View>

      {/* External navigation handoff */}
      <Button
        title="Continue in Google Maps"
        onPress={onContinueInGoogleMaps}
        loading={isHandoffPending}
        disabled={isHandoffPending}
        icon={
          <MaterialCommunityIcons
            name="google-maps"
            size={20}
            color={theme.extends.colors.background}
          />
        }
        rounded="full"
        className="mt-4 py-3.5"
        accessibilityLabel="Continue road navigation in Google Maps"
      />

      {/* Navigation context */}
      <View className="mt-2 flex-row items-center justify-center">
        <MaterialCommunityIcons
          name="navigation-variant-outline"
          size={13}
          color={theme.extends.colors.text.tertiary}
        />

        <AppText className="ml-1 text-[10px] text-text-tertiary">
          Live traffic and turn-by-turn directions in Google Maps
        </AppText>
      </View>
    </View>
  );
}
