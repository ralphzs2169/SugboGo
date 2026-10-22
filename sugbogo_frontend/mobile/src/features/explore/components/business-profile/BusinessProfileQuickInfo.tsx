import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { shadows } from "@/shared/styles/shadows";

type Props = {
  reviewCount: number | null;
  statusLabel: string;
  statusDetail: string;
  distance: string | null;
  isOpenNow: boolean | null;
  unavailable?: boolean;
};

/**
 * Displays the business's primary quick-glance information.
 *
 * Presents reviews, operating status, and distance in a compact elevated
 * three-column surface with inset separators for easy visual scanning.
 */
export default function BusinessProfileQuickInfo({
  reviewCount,
  statusLabel,
  statusDetail,
  distance,
  isOpenNow,
  unavailable = false,
}: Props) {
  const statusColor =
    isOpenNow === null
      ? theme.extends.colors.text.secondary
      : isOpenNow
        ? theme.extends.colors.success
        : theme.extends.colors.error;

  return (
    <View className="rounded-xl bg-surface" style={shadows.elevated}>
      {/* Quick information surface */}
      <View className="flex-row items-stretch overflow-hidden rounded-xl border border-border-primary bg-surface">
        {/* Review summary */}
        <View
          accessible={unavailable || undefined}
          accessibilityLabel={unavailable ? "Reviews unavailable" : undefined}
          className="min-h-[76px] flex-1 items-center justify-center px-1 py-2"
        >
          <MaterialCommunityIcons
            name="message-text-outline"
            size={18}
            color={theme.extends.colors.text.secondary}
          />

          <AppText
            weight="bold"
            className="mt-0.5 text-center text-[13px] text-text-primary"
          >
            {unavailable ? "—" : (reviewCount ?? "—")}
          </AppText>

          <AppText className="text-[11px] text-text-secondary">
            {unavailable ? "Reviews" : reviewCount === 1 ? "review" : "reviews"}
          </AppText>
        </View>

        {/* Review and status divider */}
        <View className="my-3 w-px bg-border-primary" />

        {/* Operating status */}
        <View
          accessible={unavailable || undefined}
          accessibilityLabel={
            unavailable ? "Current status unavailable" : undefined
          }
          className="min-h-[76px] flex-1 items-center justify-center px-1 py-2"
        >
          <MaterialCommunityIcons
            name="clock-outline"
            size={18}
            color={statusColor}
          />

          <AppText
            weight="bold"
            className={`mt-0.5 text-center text-[13px] ${
              isOpenNow === null
                ? "text-text-secondary"
                : isOpenNow
                  ? "text-success"
                  : "text-text-error"
            }`}
            numberOfLines={unavailable ? undefined : 1}
          >
            {unavailable ? "—" : statusLabel}
          </AppText>

          <AppText
            className="text-center text-[11px] text-text-secondary"
            numberOfLines={1}
          >
            {unavailable ? "Hours" : statusDetail}
          </AppText>
        </View>

        {/* Status and distance divider */}
        <View className="my-3 w-px bg-border-primary" />

        {/* Distance summary */}
        <View
          accessible={unavailable || undefined}
          accessibilityLabel={unavailable ? "Distance unavailable" : undefined}
          className="min-h-[76px] flex-1 items-center justify-center px-1 py-2"
        >
          <MaterialCommunityIcons
            name="map-marker-outline"
            size={18}
            color={theme.extends.colors.text.secondary}
          />

          <AppText
            weight="bold"
            className="mt-0.5 text-center text-[13px] text-text-primary"
            numberOfLines={unavailable ? undefined : 1}
          >
            {unavailable ? "—" : (distance ?? "—")}
          </AppText>

          <AppText className="text-[11px] text-text-secondary">
            {unavailable ? "Distance" : distance !== null ? "away" : "distance"}
          </AppText>
        </View>
      </View>
    </View>
  );
}
