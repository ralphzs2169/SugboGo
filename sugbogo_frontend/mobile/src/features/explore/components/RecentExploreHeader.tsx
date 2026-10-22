import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";

/** Uses the local-storage header rhythm with a clear read-only destination name. */
export default function RecentExploreHeader() {
  const durableOwner = useOfflineAccessStore((state) => state.ownerId);
  return (
    <View className="flex-row items-center gap-2 px-4 py-3">
      <SafePressable
        accessibilityRole="button"
        accessibilityLabel={
          durableOwner ? "Back to Offline Storage" : "Back to sign in"
        }
        onPress={() =>
          router.replace(durableOwner ? "/offline-storage" : "/(auth)/login")
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
        className="min-w-0 flex-1 text-xl text-text-primary"
      >
        Recent Explore
      </AppText>
    </View>
  );
}
