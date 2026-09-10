import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type Props = {
  notes: string;
};

/**
 * Displays the administrator's written explanation for a dispute decision.
 *
 * Uses a distinct administrative treatment so the moderation response is
 * visually separated from the merchant's submitted explanation.
 */
export default function ReviewDisputeAdminNotesSection({ notes }: Props) {
  return (
    <View>
      {/* Administrator statement */}
      <View className="overflow-hidden rounded-xl bg-background">
        <View className="flex-row">
          <View className="w-1 bg-blue-500" />

          <View className="flex-1 px-4 py-4">
            <MaterialCommunityIcons
              name="format-quote-open"
              size={20}
              color={theme.extends.colors.text.tertiary}
            />

            <AppText className="mt-1 text-sm leading-6 text-text-primary">
              {notes}
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}
