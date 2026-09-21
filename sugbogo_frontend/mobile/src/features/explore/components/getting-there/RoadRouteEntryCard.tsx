import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

type Props = {
  onViewRoute: () => void;
};

/** Introduces the independent Google road-route option within Getting There. */
export default function RoadRouteEntryCard({ onViewRoute }: Props) {
  return (
    <View className="mb-7 rounded-card border border-border-primary bg-surface p-4">
      {/* Road-route identity */}
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
          <MaterialCommunityIcons
            name="map-marker-path"
            size={22}
            color={theme.extends.colors.brand}
          />
        </View>

        <View className="ml-3 flex-1">
          <AppText weight="bold" className="text-base text-text-primary">
            View Road Route
          </AppText>
          <AppText className="mt-0.5 text-sm leading-5 text-text-secondary">
            See the driving route, distance, and approximate duration.
          </AppText>
        </View>
      </View>

      {/* Road-route action */}
      <Button
        title="View Route"
        onPress={onViewRoute}
        rounded="full"
        className="mt-4 py-3"
        fontClassName="text-sm"
        accessibilityLabel="View road route to this business"
      />
    </View>
  );
}
