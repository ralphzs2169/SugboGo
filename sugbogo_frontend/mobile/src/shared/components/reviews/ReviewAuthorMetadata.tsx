import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type Props = {
  dateLabel: string;
  role?: string;
};

/** Displays the review date and identifies authors with a merchant account. */
export default function ReviewAuthorMetadata({ dateLabel, role }: Props) {
  return (
    <View className="mt-0.5 flex-row flex-wrap items-center gap-x-1.5">
      {role === "merchant" && (
        <View className="max-w-full flex-row items-center gap-x-1">
          <MaterialCommunityIcons
            name="storefront-outline"
            size={12}
            color={theme.extends.colors.text.secondary}
            accessible={false}
          />
          <AppText
            accessibilityLabel="Reviewer has a merchant account on SugboGo"
            weight="semibold"
            className="shrink text-xs text-text-secondary"
          >
            Merchant
          </AppText>
        </View>
      )}

      {!!dateLabel && (
        <AppText
          accessibilityLabel={dateLabel}
          className="max-w-full text-xs text-text-secondary"
        >
          {role === "merchant" ? `·  ${dateLabel}` : dateLabel}
        </AppText>
      )}
    </View>
  );
}
