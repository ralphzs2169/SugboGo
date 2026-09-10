import { theme } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import AppText from "@/shared/components/AppText";

type Props = {
  reviewCount: number | null;
  statusLabel: string;
  statusDetail: string;
  distance: string | null;
  isOpenNow: boolean;
};

/**
 * Displays the key business facts directly below the profile hero.
 *
 * The component presents review count, operating status, and distance
 * in a compact three-column layout for quick scanning.
 */
export default function BusinessProfileQuickInfo({
  reviewCount,
  statusLabel,
  statusDetail,
  distance,
  isOpenNow,
}: Props) {
  return (
    <View className="flex-row border-b border-border-primary bg-surface">
      {/* Review count */}
      <View className="flex-1 items-center justify-center py-3">
        <MaterialCommunityIcons
          name="message-text-outline"
          size={18}
          color={theme.extends.colors.text.secondary}
        />

        <AppText className="mt-0.5 text-sm text-text-secondary">
          {reviewCount === null
            ? "—"
            : `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`}
        </AppText>
      </View>

      {/* Operating status */}
      <View className="flex-1 items-center justify-center border-x border-border-primary py-3">
        <AppText
          weight="bold"
          className={`text-[13px] ${
            isOpenNow ? "text-success" : "text-text-error"
          }`}
        >
          {statusLabel}
        </AppText>

        <AppText className="mt-0.5 text-[12px] text-text-secondary">
          {statusDetail}
        </AppText>
      </View>

      {/* Distance */}
      <View className="flex-1 items-center justify-center py-3">
        {distance !== null ? (
          <>
            <AppText weight="bold" className="text-[13px] text-text-primary">
              {distance}
            </AppText>

            <AppText className="mt-0.5 text-sm text-text-secondary">
              away
            </AppText>
          </>
        ) : (
          <>
            <AppText weight="bold" className="text-[13px] text-text-primary">
              Unavailable
            </AppText>

            <AppText className="mt-0.5 text-sm text-text-secondary">
              distance
            </AppText>
          </>
        )}
      </View>
    </View>
  );
}
