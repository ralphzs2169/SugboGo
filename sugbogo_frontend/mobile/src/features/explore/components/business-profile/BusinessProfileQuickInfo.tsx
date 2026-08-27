import { theme } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

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

        <Text className="mt-0.5 text-sm text-text-secondary">
          {reviewCount === null
            ? "—"
            : `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`}
        </Text>
      </View>

      {/* Operating status */}
      <View className="flex-1 items-center justify-center border-x border-border-primary py-3">
        <Text
          className={`text-[13px] font-bold ${
            isOpenNow ? "text-success" : "text-text-error"
          }`}
        >
          {statusLabel}
        </Text>

        <Text className="mt-0.5 text-[12px] text-text-secondary">
          {statusDetail}
        </Text>
      </View>

      {/* Distance */}
      <View className="flex-1 items-center justify-center py-3">
        {distance !== null ? (
          <>
            <Text className="text-[13px] font-bold text-text-primary">
              {distance}
            </Text>

            <Text className="mt-0.5 text-sm text-text-secondary">away</Text>
          </>
        ) : (
          <>
            <Text className="text-[13px] font-bold text-text-primary">
              Unavailable
            </Text>

            <Text className="mt-0.5 text-sm text-text-secondary">distance</Text>
          </>
        )}
      </View>
    </View>
  );
}
