import { View } from "react-native";

import AppText from "@/shared/components/AppText";

import type {
  DirectJourney,
  DirectJourneyRouteOption,
} from "../../types/directJourney.types";
import JourneyOptionCard from "./JourneyOptionCard";

type Props = {
  routeOptions: DirectJourneyRouteOption[];
  onViewMap: (journey: DirectJourney) => void;
};

/** Displays backend-grouped route codes without changing their ranking. */
export default function DirectJourneyList({
  routeOptions,
  onViewMap,
}: Props) {
  return (
    <View>
      {/* Recommended option */}
      <JourneyOptionCard
        routeOption={routeOptions[0]}
        recommended
        onViewMap={onViewMap}
      />

      {/* Other backend-ranked route codes */}
      {routeOptions.length > 1 ? (
        <View className="mt-6">
          <AppText weight="bold" className="mb-3 text-lg text-text-primary">
            Other routes
          </AppText>

          <View className="gap-3">
            {routeOptions.slice(1).map((routeOption) => (
              <JourneyOptionCard
                key={routeOption.jeepney_route_code}
                routeOption={routeOption}
                onViewMap={onViewMap}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
