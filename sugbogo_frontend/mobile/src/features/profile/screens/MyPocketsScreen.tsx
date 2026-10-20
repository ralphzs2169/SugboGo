import { type Href, router, Stack } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
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
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

/** Separates collection cards using the existing list spacing. */
function CollectionSeparator() {
  return <View className="h-3" />;
}

/**
 * Displays the authenticated explorer's collection overview in backend order.
 * Keeps loaded collections visible through refresh and pagination failures.
 */
export default function MyPocketsScreen() {
  const pockets = usePocketCollections();
  const insets = useSafeAreaInsets();
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
  const initialLoading =
    pockets.isAuthLoading ||
    (pockets.isEnabled && !pockets.hasData && !pockets.error);

  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-background">
      {/* Profile stack header */}
      <Stack.Screen options={{ title: "My Pockets" }} />

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
              <AppText
                accessibilityRole="header"
                weight="bold"
                className={`${index > 0 ? "mt-5" : ""} mb-3 text-small tracking-widest text-text-secondary`}
              >
                {item.is_default ? "DEFAULT" : "YOUR POCKETS"}
              </AppText>
            )}
            <PocketCollectionCard
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
        )}
        ItemSeparatorComponent={CollectionSeparator}
        contentContainerClassName="px-4 pt-4"
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          pockets.isEnabled ? (
            <View className="mb-6">
              <AppText className="mb-4 text-body text-text-secondary">
                Keep your favorite places together, ready for your next visit.
              </AppText>
              <Button
                title="Create Pocket"
                variant="primary"
                onPress={() => {
                  if (pockets.userId !== null)
                    setCreatingFor({
                      ownerId: pockets.userId,
                      generation: getAuthSessionGeneration(),
                    });
                }}
              />
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
              <View className="-mx-4 py-4">
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
            ) : !pockets.hasNextPage && !pockets.isFetching ? (
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
