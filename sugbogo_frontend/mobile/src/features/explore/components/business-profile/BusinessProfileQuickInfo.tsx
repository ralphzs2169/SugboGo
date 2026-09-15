import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type Props = {
  reviewCount: number | null;
  statusLabel: string;
  statusDetail: string;
  distance: string | null;
  isOpenNow: boolean;
};

/**
 * Displays the business's primary quick-glance information.
 *
 * Presents reviews, operating status, and distance in a compact floating
 * three-column card with inset separators for easier visual scanning.
 */
export default function BusinessProfileQuickInfo({
  reviewCount,
  statusLabel,
  statusDetail,
  distance,
  isOpenNow,
}: Props) {
  const statusColor = isOpenNow
    ? theme.extends.colors.success
    : theme.extends.colors.error;

  return (
    <View
      className="flex-row items-stretch overflow-hidden rounded-xl border border-border-primary bg-surface"
      style={{
        shadowColor: "#000000",
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {/* Review summary */}
      <View className="min-h-[76px] flex-1 items-center justify-center px-1 py-2">
        <MaterialCommunityIcons
          name="message-text-outline"
          size={18}
          color={theme.extends.colors.text.secondary}
        />

        <AppText weight="bold" className="mt-0.5 text-[13px] text-text-primary">
          {reviewCount ?? "—"}
        </AppText>

        <AppText className="text-[11px] text-text-secondary">
          {reviewCount === 1 ? "review" : "reviews"}
        </AppText>
      </View>

      {/* Review/status divider */}
      <View className="my-3 w-px bg-border-primary" />

      {/* Operating status */}
      <View className="min-h-[76px] flex-1 items-center justify-center px-1 py-2">
        <MaterialCommunityIcons
          name="clock-outline"
          size={18}
          color={statusColor}
        />

        <AppText
          weight="bold"
          className={`mt-0.5 text-[13px] ${
            isOpenNow ? "text-success" : "text-text-error"
          }`}
          numberOfLines={1}
        >
          {statusLabel}
        </AppText>

        <AppText
          className="text-center text-[11px] text-text-secondary"
          numberOfLines={1}
        >
          {statusDetail}
        </AppText>
      </View>

      {/* Status/distance divider */}
      <View className="my-3 w-px bg-border-primary" />

      {/* Distance summary */}
      <View className="min-h-[76px] flex-1 items-center justify-center px-1 py-2">
        <MaterialCommunityIcons
          name="map-marker-outline"
          size={18}
          color={theme.extends.colors.text.secondary}
        />

        <AppText
          weight="bold"
          className="mt-0.5 text-[13px] text-text-primary"
          numberOfLines={1}
        >
          {distance ?? "—"}
        </AppText>

        <AppText className="text-[11px] text-text-secondary">
          {distance !== null ? "away" : "distance"}
        </AppText>
      </View>
    </View>
  );
}
