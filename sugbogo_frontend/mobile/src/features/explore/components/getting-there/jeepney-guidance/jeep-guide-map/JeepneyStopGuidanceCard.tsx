import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import DottedTimelineConnector from "@/shared/components/DottedTimelineConnector";
import { shadows } from "@/shared/styles/shadows";

type Props = {
  boardingPointName: string;
  boardingDistance: string;
  alightingPointName: string;
  destinationDistance: string;
  landmarkName?: string | null;
};

const BOARDING_BACKGROUND = "#3B82F6";
const BOARDING_COLOR = "#EFF6FF";

const ALIGHTING_BACKGROUND = "#22C55E";
const ALIGHTING_COLOR = "#F0FDF4";

/**
 * Displays the boarding and alighting stops for a selected Jeepney journey.
 *
 * Presents both stops as an ordered sequence with approximate access distances
 * while matching the visual language of the corresponding map markers.
 */
export default function JeepneyStopGuidanceCard({
  boardingPointName,
  boardingDistance,
  alightingPointName,
  destinationDistance,
  landmarkName,
}: Props) {
  return (
    <View
      className="rounded-t-3xl border-t border-border-primary bg-surface px-4 pb-3 pt-3.5"
      style={shadows.docked}
    >
      {/* Guidance heading */}
      <View className="mb-3 flex-row items-center justify-between">
        <View>
          <AppText weight="bold" className="text-base text-text-primary">
            Your stops
          </AppText>

          <AppText className="mt-0.5 text-xs text-text-secondary">
            Where to board and get off
          </AppText>
        </View>

        <View className="h-8 w-8 items-center justify-center rounded-full bg-surface-secondary">
          <MaterialCommunityIcons
            name="transit-connection-variant"
            size={17}
            color={theme.extends.colors.text.secondary}
          />
        </View>
      </View>

      {/* Boarding point */}
      <View className="flex-row items-start">
        <View className="items-center">
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{
              backgroundColor: BOARDING_BACKGROUND,
            }}
          >
            <MaterialCommunityIcons
              name="bus-stop"
              size={18}
              color={BOARDING_COLOR}
            />
          </View>

          <DottedTimelineConnector className="my-1 h-6" />
        </View>

        <View className="ml-3 min-w-0 flex-1 pb-1">
          <View className="flex-row items-center justify-between gap-3">
            <AppText
              weight="bold"
              className="text-[10px] uppercase tracking-wide"
              style={{
                color: BOARDING_BACKGROUND,
              }}
            >
              Board
            </AppText>

            <View className="rounded-full bg-surface-secondary px-2 py-1">
              <AppText className="text-[10px] text-text-secondary">
                ~{boardingDistance} from start
              </AppText>
            </View>
          </View>

          <AppText
            weight="semibold"
            className="mt-1 text-sm leading-5 text-text-primary"
            numberOfLines={2}
          >
            {boardingPointName}
          </AppText>
        </View>
      </View>

      {/* Alighting point */}
      <View className="flex-row items-start">
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{
            backgroundColor: ALIGHTING_BACKGROUND,
          }}
        >
          <MaterialCommunityIcons
            name="exit-run"
            size={18}
            color={ALIGHTING_COLOR}
          />
        </View>

        <View className="ml-3 min-w-0 flex-1">
          <View className="flex-row items-center justify-between gap-3">
            <AppText
              weight="bold"
              className="text-[10px] uppercase tracking-wide"
              style={{
                color: ALIGHTING_BACKGROUND,
              }}
            >
              Get off
            </AppText>

            <View className="rounded-full bg-surface-secondary px-2 py-1">
              <AppText className="text-[10px] text-text-secondary">
                ~{destinationDistance} to destination
              </AppText>
            </View>
          </View>

          <AppText
            weight="semibold"
            className="mt-1 text-sm leading-5 text-text-primary"
            numberOfLines={2}
          >
            {alightingPointName}
          </AppText>

          {landmarkName && (
            <View className="mt-1 flex-row items-center">
              <MaterialCommunityIcons
                name="map-marker-radius-outline"
                size={13}
                color={theme.extends.colors.text.secondary}
              />

              <AppText
                className="ml-1 min-w-0 flex-1 text-xs text-text-secondary"
                numberOfLines={1}
              >
                Near {landmarkName}
              </AppText>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
