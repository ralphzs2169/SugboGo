import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

import type { DirectJourney } from "../../types/directJourney.types";
import { formatJourneyDistance } from "../../utils/directJourney.utils";

type Props = {
  journey: DirectJourney;
  optionNumber: number;
  onViewMap: (journey: DirectJourney) => void;
};

/** Displays one compact alternative boarding and alighting combination. */
export default function AlternativeJourneyCard({
  journey,
  optionNumber,
  onViewMap,
}: Props) {
  return (
    <View className="rounded-xl bg-background px-4 py-4">
      {/* Alternative identity */}
      <AppText weight="bold" className="text-xs uppercase text-brand">
        Option {optionNumber}
      </AppText>
      <AppText weight="semibold" className="mt-1 text-sm text-text-primary">
        {journey.route_variant_origin.name} → {journey.route_variant_destination.name}
      </AppText>

      {/* Stop and proximity details */}
      <View className="mt-3 gap-3">
        <View>
          <AppText weight="bold" className="text-xs text-text-secondary">
            Board
          </AppText>
          <AppText weight="semibold" className="mt-0.5 text-sm text-text-primary">
            {journey.boarding_transit_point.name}
          </AppText>
          <AppText className="mt-0.5 text-xs text-text-secondary">
            Approx. {formatJourneyDistance(
              journey.explorer_to_boarding_distance_meters,
            )} to boarding
          </AppText>
        </View>

        <View>
          <AppText weight="bold" className="text-xs text-text-secondary">
            Get off
          </AppText>
          <AppText weight="semibold" className="mt-0.5 text-sm text-text-primary">
            {journey.alighting_transit_point.name}
          </AppText>
          <AppText className="mt-0.5 text-xs text-text-secondary">
            Approx. {formatJourneyDistance(
              journey.alighting_to_business_distance_meters,
            )} from drop-off to destination
          </AppText>
          {journey.landmark_context && (
            <AppText weight="semibold" className="mt-1 text-xs text-brand">
              Near {journey.landmark_context.name}
            </AppText>
          )}
        </View>
      </View>

      <Button
        title="View on map"
        variant="outline"
        rounded="full"
        className="mt-4 py-3"
        fontClassName="text-sm"
        icon={
          <MaterialCommunityIcons
            name="map-outline"
            size={17}
            color={theme.extends.colors.text.primary}
          />
        }
        onPress={() => onViewMap(journey)}
      />
    </View>
  );
}
