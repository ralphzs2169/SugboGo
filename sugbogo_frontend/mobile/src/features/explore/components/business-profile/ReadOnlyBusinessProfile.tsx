import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { RefreshControl, ScrollView, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import OfflineBusinessContent from "@/features/offline-pockets/components/OfflineBusinessContent";
import type { OfflineBusinessSnapshot } from "@/features/offline-pockets/validation/offlineBusinessSnapshot";
import SafePressable from "@/shared/components/SafePressable";

/** Presents historical information without mounting reviews, actions, maps or analytics. */
export default function ReadOnlyBusinessProfile({
  snapshot,
  source,
  localCoverUri,
  onRefresh,
  refreshing,
}: {
  snapshot: OfflineBusinessSnapshot;
  source: "offline-pocket" | "recent";
  localCoverUri?: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { top, bottom } = useSafeAreaInsets();
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      {/* The profile's cover proportions and information hierarchy stay intact. */}
      <ScrollView
        testID="read-only-business-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <OfflineBusinessContent
          snapshot={snapshot}
          source={source}
          localCoverUri={localCoverUri}
        />
      </ScrollView>
      {/* Keep navigation reachable after scrolling long descriptions/schedules. */}
      <View className="absolute left-4 z-10" style={{ top: top + 16 }}>
        <SafePressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="min-h-12 min-w-12 items-center justify-center rounded-full bg-surface active:opacity-80"
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={26}
            color={theme.extends.colors.text.primary}
            accessible={false}
          />
        </SafePressable>
      </View>
    </SafeAreaView>
  );
}
