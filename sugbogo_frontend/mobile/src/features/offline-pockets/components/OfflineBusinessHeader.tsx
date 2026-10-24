import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

/** Matches the app's compact back header without mounting authenticated profile controls. */
export default function OfflineBusinessHeader({
  detail = false,
}: {
  detail?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2 px-screen-x pb-3 pt-2">
      <SafePressable
        accessibilityRole="button"
        accessibilityLabel={
          detail ? "Back to saved businesses" : "Back to Offline Storage"
        }
        onPress={() =>
          router.dismissTo(detail ? "/offline-pockets" : "/offline-storage")
        }
        className="min-h-12 min-w-12 items-center justify-center rounded-full active:bg-surface-muted"
      >
        <MaterialCommunityIcons
          name="chevron-left"
          size={28}
          color={theme.extends.colors.text.primary}
          accessible={false}
        />
      </SafePressable>
      <AppText
        accessibilityRole="header"
        weight="bold"
        className="flex-1 text-xl text-text-primary"
      >
        {detail ? "Saved business" : "Saved businesses"}
      </AppText>
    </View>
  );
}
