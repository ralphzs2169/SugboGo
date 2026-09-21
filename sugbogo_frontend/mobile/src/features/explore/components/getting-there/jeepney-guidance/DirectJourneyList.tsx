import { View } from "react-native";

import AppText from "@/shared/components/AppText";

import type {
  DirectJourney,
  DirectJourneyRouteOption,
} from "../../../types/directJourney.types";
import JourneyOptionCard from "./JourneyOptionCard";

type Props = {
  routeOptions: DirectJourneyRouteOption[];
  onViewMap: (journey: DirectJourney) => void;
};

/**
 * Displays backend-ranked Jeepney route options without changing their order.
 *
 * Introduces the available route choices, highlights the recommended option,
 * and groups the remaining backend-ranked alternatives underneath it.
 */
export default function DirectJourneyList({ routeOptions, onViewMap }: Props) {
  return (
    <View>
      {/* Route options heading */}
      <View className="mb-4 flex-row items-end justify-between gap-3">
        <View className="min-w-0 flex-1">
          <AppText weight="bold" className="text-base text-text-primary">
            Route options
          </AppText>

          <AppText className="mt-0.5 text-xs text-text-secondary">
            Jeepney routes from your starting point
          </AppText>
        </View>

        <View className="rounded-full bg-surface-secondary px-2.5 py-1">
          <AppText
            weight="semibold"
            className="text-[11px] text-text-secondary"
          >
            {routeOptions.length}{" "}
            {routeOptions.length === 1 ? "route" : "routes"}
          </AppText>
        </View>
      </View>

      {/* Recommended option */}
      <JourneyOptionCard
        routeOption={routeOptions[0]}
        recommended
        onViewMap={onViewMap}
      />

      {/* Other backend-ranked route codes */}
      {routeOptions.length > 1 && (
        <View className="mt-6">
          <AppText weight="bold" className="mb-3 text-sm text-text-primary">
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
      )}
    </View>
  );
}
