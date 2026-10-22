import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type Href, router, Stack } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import { shadows } from "@/shared/styles/shadows";
import { useAuthStore } from "@/features/auth/store/auth.store";
import PocketCollectionActions from "@/features/pockets/components/PocketCollectionActions";
import PocketCollectionCard from "@/features/pockets/components/PocketCollectionCard";
import PocketCollectionsSkeleton from "@/features/pockets/components/PocketCollectionsSkeleton";
import PocketNameDialog from "@/features/pockets/components/PocketNameDialog";
import usePocketCollections from "@/features/pockets/hooks/usePocketCollections";
import type { PocketCollection } from "@/features/pockets/types/pockets.types";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

/**
 * Displays the authenticated explorer's collection overview in backend order.
 * Keeps loaded collections visible through refresh and pagination failures.
 */
export default function MyPocketsScreen() {
  const pockets = usePocketCollections();
  const insets = useSafeAreaInsets();
  const [creationActionHeight, setCreationActionHeight] = useState(64);
  const requests = useRef({ armed: false, paging: false, refreshing: false });
  const [creatingFor, setCreatingFor] = useState<{
    ownerId: number;
    generation: number;
  } | null>(null);
  const [managing, setManaging] = useState<{
    collection: PocketCollection;
    ownerId: number;
    generation: number;
  } | null>(null);
  const showCreation =
    pockets.isEnabled &&
    creatingFor?.ownerId === pockets.userId &&
    creatingFor?.generation === getAuthSessionGeneration();

  useEffect(() => {
    // Old requests keep their own guard object when the account changes.
    requests.current = { armed: false, paging: false, refreshing: false };
  }, [pockets.userId, pockets.isEnabled]);

  useQueryErrorNotification({
    error: pockets.isEnabled ? pockets.error : null,
    toastId: "my-pockets-error",
    title: "Unable to load your Pockets",
    fallbackMessage: "Please try again.",
  });

  function refreshCollections() {
    const request = requests.current;
    if (
      !pockets.isEnabled ||
      request.refreshing ||
      request.paging ||
      pockets.isFetching
    ) {
      return;
    }

    request.refreshing = true;
    request.armed = false;
    void pockets.refetch().finally(() => {
      request.refreshing = false;
    });
  }

  function loadNextPage(retry = false) {
    const request = requests.current;
    if (
      !pockets.isEnabled ||
      request.paging ||
      request.refreshing ||
      pockets.isFetching ||
      !pockets.hasNextPage ||
      (!retry && (!request.armed || pockets.isFetchNextPageError))
    ) {
      return;
    }

    request.paging = true;
    request.armed = false;
    void pockets.fetchNextPage().finally(() => {
      request.paging = false;
    });
  }

  const collections = pockets.isEnabled ? pockets.collections : [];
  const hasCollections = collections.length > 0;
  const showEndMessage =
    pockets.isEnabled &&
    hasCollections &&
    !pockets.hasNextPage &&
    !pockets.isFetching &&
    !pockets.error &&
    collections.length >= 5;
  const initialLoading =
    pockets.isAuthLoading ||
    (pockets.isEnabled && !pockets.hasData && !pockets.error);

  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-surface">
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          title: "My Pockets",
        }}
      />

      {/* Collections and request recovery */}
      <FlatList
        key={pockets.userId ?? "signed-out"}
        testID="my-pockets-list"
        data={collections}
        keyExtractor={(collection) => String(collection.id)}
        renderItem={({ item, index }) => (
          <View>
            {(index === 0 ||
              collections[index - 1].is_default !== item.is_default) && (
              <View
                className={`${index > 0 ? "mt-5" : ""} mb-2 flex-row items-center gap-2`}
              >
                <MaterialCommunityIcons
                  name={item.is_default ? "heart-outline" : "wallet-outline"}
                  size={16}
                  color={theme.extends.colors.text.secondary}
                  accessible={false}
                />
                <AppText
                  accessibilityRole="header"
                  weight="semibold"
                  className="text-xs text-text-secondary"
                >
                  {item.is_default ? "Favorites" : "Custom Pockets"}
                </AppText>
              </View>
            )}
            <View
              collapsable={false}
              className={`overflow-hidden border-x border-border-primary bg-surface ${
                index === 0 ||
                collections[index - 1].is_default !== item.is_default
                  ? "rounded-t-card border-t"
                  : ""
              } ${index === collections.length - 1 || collections[index + 1].is_default !== item.is_default ? "rounded-b-card border-b" : ""}`}
            >
              {index > 0 &&
                collections[index - 1].is_default === item.is_default && (
                  <View className="mx-4 h-px bg-border-primary/60" />
                )}
              <PocketCollectionCard
                compact
                collection={item}
                onPress={() =>
                  router.push(`/(explorer)/profile/pockets/${item.id}` as Href)
                }
                onManage={
                  item.is_default
                    ? undefined
                    : () => {
                        if (
                          pockets.userId === null ||
                          useAuthStore.getState().user?.id !== pockets.userId
                        )
                          return;
                        setManaging({
                          collection: item,
                          ownerId: pockets.userId,
                          generation: getAuthSessionGeneration(),
                        });
                      }
                }
              />
            </View>
          </View>
        )}
        className="bg-surface"
        contentContainerClassName="bg-surface px-4 pt-4"
        contentContainerStyle={{
          flexGrow: 1,
        }}
        ListFooterComponentStyle={{
          flexGrow: showEndMessage ? 1 : 0,
          marginHorizontal: -16,
          marginTop: showEndMessage ? 16 : 0,
          backgroundColor: showEndMessage
            ? theme.extends.colors.background
            : theme.extends.colors.surface,
          paddingBottom:
            insets.bottom +
            (pockets.isEnabled ? creationActionHeight + 48 : 24),
        }}
        ListHeaderComponent={
          pockets.isEnabled ? (
            <View className="mb-4 flex-row items-center justify-between gap-3">
              <AppText className="min-w-0 flex-1 text-body text-text-secondary">
                Your places, organized.
              </AppText>
              {pockets.hasData && (
                <AppText weight="bold" className="text-sm text-text-secondary">
                  {pockets.totalCount}{" "}
                  {pockets.totalCount === 1 ? "Pocket" : "Pockets"}
                </AppText>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          initialLoading ? (
            <PocketCollectionsSkeleton />
          ) : !pockets.isEnabled ? (
            <View className="items-center py-10">
              <AppText
                weight="semibold"
                className="text-center text-lg text-text-primary"
              >
                Sign in to view your Pockets
              </AppText>
              <Button
                title="Sign in"
                onPress={() => router.push("/(auth)/login")}
                size="sm"
                rounded="full"
                className="mt-4"
              />
            </View>
          ) : pockets.error ? (
            <ErrorState
              title="Unable to load your Pockets"
              description="Please try again to load your collections."
              primaryActionTitle="Retry"
              onPrimaryAction={refreshCollections}
            />
          ) : pockets.hasData ? (
            <View testID="my-pockets-empty" className="items-center py-10">
              <AppText
                weight="semibold"
                className="text-center text-lg text-text-primary"
              >
                No Pockets yet
              </AppText>
              <AppText className="mt-2 text-center text-body text-text-secondary">
                Your saved-business collections will appear here.
              </AppText>
            </View>
          ) : null
        }
        ListFooterComponent={
          pockets.isEnabled && hasCollections ? (
            pockets.isFetchingNextPage ? (
              <View
                testID="my-pockets-page-loader"
                className="items-center py-5"
              >
                <LottieView
                  source={loadingAnimation}
                  autoPlay
                  loop
                  style={{ width: 50, height: 50 }}
                />
              </View>
            ) : pockets.error ? (
              <View className="py-4">
                <ErrorState
                  size="section"
                  title={
                    pockets.isFetchNextPageError
                      ? "Unable to load more Pockets"
                      : "Unable to refresh your Pockets"
                  }
                  description="Your loaded collections are still available."
                  primaryActionTitle="Retry"
                  onPrimaryAction={
                    pockets.isFetchNextPageError
                      ? () => loadNextPage(true)
                      : refreshCollections
                  }
                />
              </View>
            ) : showEndMessage ? (
              <EndOfListMessage description="You've seen all your Pockets." />
            ) : null
          ) : null
        }
        onScrollBeginDrag={() => {
          requests.current.armed = true;
        }}
        onEndReached={() => loadNextPage()}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        refreshControl={
          <RefreshControl
            enabled={pockets.isEnabled}
            refreshing={
              pockets.isEnabled &&
              pockets.isRefetching &&
              !pockets.isFetchingNextPage
            }
            onRefresh={refreshCollections}
            tintColor={theme.extends.colors.brand}
          />
        }
      />
      {/* Collection creation stays reachable above the profile stack safe area. */}
      {pockets.isEnabled && (
        <View
          testID="create-pocket-fab"
          onLayout={({ nativeEvent }) =>
            setCreationActionHeight(nativeEvent.layout.height)
          }
          className="absolute right-4 z-30 max-w-[90%] rounded-full bg-brand"
          style={[{ bottom: insets.bottom + 16 }, shadows.floating]}
        >
          <Button
            title="Create Pocket"
            accessibilityLabel="Create Pocket"
            onPress={() => {
              if (pockets.userId !== null)
                setCreatingFor({
                  ownerId: pockets.userId,
                  generation: getAuthSessionGeneration(),
                });
            }}
            icon={
              <MaterialCommunityIcons
                name="plus"
                size={18}
                color="#FFFFFF"
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            }
            rounded="full"
            className="px-5 py-3.5"
            fontClassName="text-sm"
          />
        </View>
      )}
      {pockets.isEnabled &&
        managing &&
        managing.ownerId === pockets.userId &&
        managing.generation === getAuthSessionGeneration() && (
          <PocketCollectionActions
            key={`${managing.ownerId}:${managing.generation}:${managing.collection.id}`}
            collection={managing.collection}
            onClose={() => setManaging(null)}
          />
        )}
      {showCreation && (
        <PocketNameDialog
          key={`${creatingFor.ownerId}:${creatingFor.generation}`}
          onCancel={() => setCreatingFor(null)}
          onSuccess={() => setCreatingFor(null)}
        />
      )}
    </SafeAreaView>
  );
}
