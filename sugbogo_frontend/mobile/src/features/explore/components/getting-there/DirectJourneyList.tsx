import { View } from "react-native";

import AppText from "@/shared/components/AppText";

import type { DirectJourney } from "../../types/directJourney.types";
import JourneyOptionCard from "./JourneyOptionCard";

type Props = {
  journeys: DirectJourney[];
  businessName: string;
};

/**
 * Displays direct options in the backend's ranked order.
 *
 * The first option is identified as recommended and expanded for quick reading.
 */
export default function DirectJourneyList({
  journeys,
  businessName,
}: Props) {
  return (
    <View>
      {/* Recommended option */}
      <JourneyOptionCard
        journey={journeys[0]}
        businessName={businessName}
        recommended
      />

      {/* Ranked alternatives */}
      {journeys.length > 1 ? (
        <View className="mt-6">
          <AppText weight="bold" className="mb-3 text-lg text-text-primary">
            Other options
          </AppText>

          <View className="gap-3">
            {journeys.slice(1).map((journey) => (
              <JourneyOptionCard
                key={`${journey.route_variant_id}-${journey.boarding_transit_point.id}-${journey.alighting_transit_point.id}`}
                journey={journey}
                businessName={businessName}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
