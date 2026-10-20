import { router, Stack } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useRef } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import CompactBusinessListSkeleton from "@/features/explore/components/CompactBusinessListSkeleton";
import BusinessCard from "../components/PocketBusinessCard";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

import PocketCollectionCard from "../components/PocketCollectionCard";
import usePocketCollection from "../hooks/usePocketCollection";
import usePocketCollectionBusinesses from "../hooks/usePocketCollectionBusinesses";

type Props = { collectionId: number | null };

/**
 * Displays private Pocket metadata and available saved businesses in backend order.
 * Keeps loaded content during refresh and pagination failures without membership actions.
 */
export default function PocketCollectionScreen({ collectionId }: Props) {
  const metadata = usePocketCollection(collectionId);
  const contents = usePocketCollectionBusinesses(collectionId);
  const insets = useSafeAreaInsets();
  const requests = useRef({ armed: false, paging: false, refreshing: false });
  const isValidId =
    typeof collectionId === "number" &&
    Number.isSafeInteger(collectionId) &&
    collectionId > 0;
  const unavailable = Boolean(
    metadata.isEnabled &&
    metadata.error &&
    typeof metadata.error === "object" &&
    "code" in metadata.error &&
    metadata.error.code === "NOT_FOUND",
  );
  const canShowContents =
    metadata.isEnabled && metadata.hasData && !unavailable;
  const businesses = canShowContents ? contents.businesses : [];

  useEffect(() => {
    // Settling requests retain their own guards after an identity change.
    requests.current = { armed: false, paging: false, refreshing: false };
  }, [collectionId, metadata.userId, metadata.isEnabled]);

  useQueryErrorNotification({
    error: metadata.isEnabled
      ? (metadata.error ?? (metadata.hasData ? contents.error : null))
      : null,
    toastId: "pocket-detail-error",
    title: "Unable to load this Pocket",
    fallbackMessage: "Please try again.",
  });

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(explorer)/profile/my-pockets");
  }

  function refresh(target: "metadata" | "businesses" | "both" = "both") {
    const request = requests.current;
    if (
      !metadata.isEnabled ||
      !contents.isEnabled ||
      request.paging ||
      request.refreshing ||
      (target !== "businesses" && metadata.isFetching) ||
      (target !== "metadata" && contents.isFetching)
    )
      return;

    request.refreshing = true;
    request.armed = false;
    const queries = [
      ...(target !== "businesses" ? [metadata.refetch()] : []),
      ...(target !== "metadata" ? [contents.refetch()] : []),
    ];
    void Promise.all(queries).finally(() => {
      request.refreshing = false;
    });
  }

  function loadNextPage(retry = false) {
    const request = requests.current;
    if (
      !canShowContents ||
      !contents.isEnabled ||
      request.paging ||
      request.refreshing ||
      contents.isFetching ||
      !contents.hasNextPage ||
      (!retry && (!request.armed || contents.isFetchNextPageError))
    )
      return;

    request.paging = true;
    request.armed = false;
    void contents.fetchNextPage().finally(() => {
      request.paging = false;
    });
  }

  const loading = (
    <View
      accessibilityLabel="Loading saved businesses"
      accessibilityState={{ busy: true }}
    >
      <CompactBusinessListSkeleton
        testID="pocket-detail-loading"
        applyXPadding={false}
      />
    </View>
  );

  const emptyContent = !isValidId ? (
    <ErrorState
      title="Pocket not found"
      description="Choose a Pocket from My Pockets."
      primaryActionTitle="Go back"
      onPrimaryAction={goBack}
    />
  ) : metadata.isAuthLoading ? (
    loading
  ) : !metadata.isEnabled ? (
    <View className="items-center py-10">
      <AppText
        weight="semibold"
        className="text-center text-lg text-text-primary"
      >
        Sign in to view this Pocket
      </AppText>
      <Button
        title="Sign in"
        size="sm"
        rounded="full"
        className="mt-4"
        onPress={() => router.push("/(auth)/login")}
      />
    </View>
  ) : unavailable ? (
    <ErrorState
      title="Pocket unavailable"
      description="This Pocket no longer exists or isn't available to your account."
      primaryActionTitle="Go back"
      onPrimaryAction={goBack}
    />
  ) : !metadata.hasData ? (
    metadata.error ? (
      <ErrorState
        title="Unable to load this Pocket"
        description="Please try again to load its details."
        primaryActionTitle="Retry"
        onPrimaryAction={() => refresh("metadata")}
      />
    ) : (
      loading
    )
  ) : contents.error ? (
    <ErrorState
      title="Unable to load saved businesses"
      description="Your Pocket is still available. Try loading its businesses again."
      primaryActionTitle="Retry"
      onPrimaryAction={() => refresh("businesses")}
    />
  ) : !contents.hasData ? (
    loading
  ) : (
    <View testID="pocket-detail-empty" className="items-center py-10">
      <AppText
        weight="semibold"
        className="text-center text-lg text-text-primary"
      >
        No available businesses yet
      </AppText>
      <AppText className="mt-2 text-center text-body text-text-secondary">
        Businesses saved here will appear when they are available.
      </AppText>
    </View>
  );

  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-background">
      {/* Profile stack identity */}
      <Stack.Screen
        options={{
          title: canShowContents ? metadata.collection?.name : "Pocket",
        }}
      />

      {/* Collection summary and paginated saved businesses */}
      <FlatList
        key={`${metadata.userId ?? "signed-out"}:${collectionId}`}
        testID="pocket-businesses-list"
        data={businesses}
        keyExtractor={(business) => String(business.id)}
        contentContainerClassName="px-4 pt-4"
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          canShowContents && metadata.collection ? (
            <View className="mb-4">
              <PocketCollectionCard collection={metadata.collection} />
              {metadata.error && (
                <View className="-mx-4 mt-3">
                  <ErrorState
                    size="section"
                    title="Unable to refresh Pocket details"
                    description="Your loaded details are still available."
                    primaryActionTitle="Retry details"
                    onPrimaryAction={() => refresh("metadata")}
                  />
                </View>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View className="mb-3">
            <BusinessCard
              business={item}
              variant="compact"
              distance={null}
              distanceAccuracy={null}
              onPress={() =>
                router.push({
                  pathname: "/(explorer)/business/[businessId]",
                  params: { businessId: String(item.id) },
                })
              }
            />
          </View>
        )}
        ListEmptyComponent={emptyContent}
        ListFooterComponent={
          canShowContents && businesses.length > 0 ? (
            contents.isFetchingNextPage ? (
              <View
                testID="pocket-businesses-page-loader"
                className="items-center py-5"
              >
                <LottieView
                  source={loadingAnimation}
                  autoPlay
                  loop
                  style={{ width: 50, height: 50 }}
                />
              </View>
            ) : contents.error ? (
              <View className="-mx-4 py-4">
                <ErrorState
                  size="section"
                  title={
                    contents.isFetchNextPageError
                      ? "Unable to load more businesses"
                      : "Unable to refresh saved businesses"
                  }
                  description="Your loaded businesses are still available."
                  primaryActionTitle="Retry businesses"
                  onPrimaryAction={
                    contents.isFetchNextPageError
                      ? () => loadNextPage(true)
                      : () => refresh("businesses")
                  }
                />
              </View>
            ) : !contents.hasNextPage && !contents.isFetching ? (
              <EndOfListMessage />
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
            enabled={metadata.isEnabled && !unavailable}
            refreshing={
              metadata.isEnabled &&
              !contents.isFetchingNextPage &&
              (metadata.isRefetching || contents.isRefetching)
            }
            onRefresh={() => refresh()}
            tintColor={theme.extends.colors.brand}
          />
        }
      />
    </SafeAreaView>
  );
}
