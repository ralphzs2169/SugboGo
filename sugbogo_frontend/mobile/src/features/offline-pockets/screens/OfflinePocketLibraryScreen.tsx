import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { FlatList, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import OfflineBusinessCard from "../components/OfflineBusinessCard";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";
import useOfflineBusinessSnapshots from "../hooks/useOfflineBusinessSnapshots";

/** Flat, device-only business library; collections remain managed in My Pockets online. */
export default function OfflinePocketLibraryScreen() {
  const saved = useOfflineBusinessSnapshots();
  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      className="flex-1 bg-surface"
    >
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          title: "Saved businesses",
        }}
      />
      {/* Storage reads stay available in airplane mode. */}
      {saved.ownerId === null ? (
        <ErrorState
          size="small"
          icon="lock-outline"
          title="Sign in to access saved businesses"
          description="Offline access is no longer available for this session."
          primaryActionTitle="Sign in"
          onPrimaryAction={() => router.replace("/(auth)/login")}
        />
      ) : Platform.OS === "web" ? (
        <ErrorState
          size="small"
          icon="cellphone"
          title="Available in the mobile app"
          description="Saved offline businesses are available on Android and iOS."
        />
      ) : saved.isPending ? (
        <View className="gap-3 px-4 pt-4">
          <Skeleton className="h-36 rounded-card" />
          <Skeleton className="h-36 rounded-card" />
        </View>
      ) : saved.isError ? (
        <ErrorState
          size="small"
          icon="database-alert-outline"
          title="Unable to read saved businesses"
          description="Your device storage couldn't be read. Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={() => void saved.refetch()}
        />
      ) : (
        <FlatList
          data={saved.data?.entries ?? []}
          keyExtractor={(entry) => String(entry.businessId)}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="grow px-4 pb-6 pt-4"
          ListHeaderComponent={
            <View className="mb-4 border-b border-border-primary/60 pb-3">
              <View className="flex-row items-center justify-between gap-3">
                <AppText className="min-w-0 flex-1 text-sm text-text-secondary">
                  Ready to view offline.
                </AppText>
                <AppText
                  weight="semibold"
                  className="text-sm text-text-secondary"
                >
                  {saved.data?.entries.length ?? 0} saved
                </AppText>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="items-center px-8 py-10">
              <Image
                source={require("@/shared/assets/mascot/mascot-no-filter-result.webp")}
                style={{ width: 120, height: 120 }}
                contentFit="contain"
                accessible={false}
              />
              <AppText
                weight="bold"
                className="mt-2 text-center text-md text-text-primary"
              >
                No saved businesses yet
              </AppText>
              <AppText className="mt-1 text-center text-sm leading-5 text-text-secondary">
                Save places to your Pockets while online. Their device copies
                appear here once ready.
              </AppText>
            </View>
          }
          renderItem={({ item }) => (
            <OfflineBusinessCard
              entry={item}
              localCoverUri={saved.data?.covers?.[item.businessId]}
              onPress={() =>
                router.push({
                  pathname: "/offline-business/[businessId]",
                  params: { businessId: String(item.businessId) },
                })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
