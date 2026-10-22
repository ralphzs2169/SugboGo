import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { FlatList, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import OfflineBusinessCard from "../components/OfflineBusinessCard";
import OfflineBusinessHeader from "../components/OfflineBusinessHeader";
import useOfflineBusinessSnapshots from "../hooks/useOfflineBusinessSnapshots";

/** Flat, device-only business library; collections remain managed in My Pockets online. */
export default function OfflinePocketLibraryScreen() {
  const saved = useOfflineBusinessSnapshots();
  return (
    <SafeAreaView className="flex-1 bg-background">
      <OfflineBusinessHeader />
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
        <View className="gap-3 px-screen-x">
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
          contentContainerClassName="grow px-screen-x pb-6"
          ListHeaderComponent={
            <AppText className="pb-5 text-sm leading-5 text-text-secondary">
              Available on this device, even without internet. Your Pockets stay
              saved online.
            </AppText>
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-4 pb-16">
              <MaterialCommunityIcons
                name="storefront-outline"
                size={44}
                color={theme.extends.colors.text.tertiary}
                accessible={false}
              />
              <AppText
                weight="bold"
                className="mt-4 text-center text-lg text-text-primary"
              >
                No saved businesses yet
              </AppText>
              <AppText className="mt-2 text-center text-sm leading-6 text-text-secondary">
                Businesses you save to Pockets online appear here once their
                information is ready.
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
