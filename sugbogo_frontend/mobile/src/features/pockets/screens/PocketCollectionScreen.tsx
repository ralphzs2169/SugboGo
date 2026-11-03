import useBusinessAvailability from "@/features/business-availability/hooks/useBusinessAvailability";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { hashKey } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import { useAuthStore } from "@/features/auth/store/auth.store";
import CompactBusinessListSkeleton from "@/features/explore/components/CompactBusinessListSkeleton";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import BusinessCard from "../components/PocketBusinessCard";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import SafePressable from "@/shared/components/SafePressable";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";

import PocketCollectionActions from "../components/PocketCollectionActions";
import PocketBusinessRemovalConfirmation from "../components/PocketBusinessRemovalConfirmation";
import PocketBusinessActions from "../components/PocketBusinessActions";
import usePocketCollection from "../hooks/usePocketCollection";
import usePocketCollectionBusinesses from "../hooks/usePocketCollectionBusinesses";
import { pocketCollectionBusinessesQueryKey } from "../hooks/pocketQueryKeys";
import type { PocketCollection } from "../types/pockets.types";

type Props = { collectionId: number | null };

/**
 * Displays private Pocket metadata and available saved businesses in backend order.
 * Keeps loaded content during refresh and pagination failures.
 */
export default function PocketCollectionScreen({ collectionId }: Props) {
  const metadata = usePocketCollection(collectionId);
  const contents = usePocketCollectionBusinesses(collectionId);
  const insets = useSafeAreaInsets();
  const requests = useRef({ armed: false, paging: false, refreshing: false });
  const [managing, setManaging] = useState<{
    collection: PocketCollection;
    ownerId: number;
    generation: number;
  } | null>(null);
  const [removing, setRemoving] = useState<{
    collectionId: number;
    business: {
      id: number;
      business_name: string;
      availability?: "available" | "unavailable";
    };
    ownerId: number;
    generation: number;
  } | null>(null);
  const [businessAction, setBusinessAction] = useState<typeof removing>(null);
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
  const { get: getAvailability, revision: availabilityRevision } =
    useBusinessAvailability(
      contents.businesses.map((business) => business.id),
      { check: false },
    );
  const businesses = useMemo(
    () =>
      canShowContents
        ? contents.businesses.map((business) => {
            const record = getAvailability(business.id);
            return record?.state === "unavailable"
              ? {
                  id: business.id,
                  business_name: business.business_name,
                  is_pocketed: true,
                  availability: "unavailable" as const,
                  availability_checked_at: record.checkedAt,
                }
              : business;
          })
        : [],
    [
      canShowContents,
      contents.businesses,
      availabilityRevision,
      getAvailability,
    ],
  );

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
    <View testID="pocket-detail-empty" className="items-center px-8 py-10">
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
        {metadata.collection?.business_count === 0
          ? "Your next find belongs here"
          : "No available businesses right now"}
      </AppText>
      <AppText className="mt-1 text-center text-sm leading-5 text-text-secondary">
        {metadata.collection?.business_count === 0
          ? "Save a business from Explore and choose this Pocket."
          : "Your saved businesses will appear here when they're available again."}
      </AppText>
      <Button
        title="Explore places"
        size="sm"
        rounded="full"
        className="mt-4"
        onPress={() => router.push("/(explorer)/(tabs)/explore")}
      />
    </View>
  );

  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-surface">
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
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
              <View className="flex-row items-center justify-between border-b border-border-primary/60 pb-3">
                <AppText className="min-w-0 flex-1 text-sm text-text-secondary">
                  {metadata.collection.business_count} saved{" "}
                  {metadata.collection.business_count === 1
                    ? "business"
                    : "businesses"}
                </AppText>
                {metadata.collection.available_business_count !== undefined &&
                  metadata.collection.available_business_count <
                    metadata.collection.business_count && (
                    <AppText className="mr-2 text-xs text-text-secondary">
                      {metadata.collection.available_business_count} available
                    </AppText>
                  )}
                {!metadata.collection.is_default && (
                  <SafePressable
                    accessibilityRole="button"
                    accessibilityLabel="Manage this Pocket"
                    className="h-12 w-12 items-center justify-center rounded-full active:bg-surface-muted"
                    onPress={() => {
                      if (
                        !metadata.collection ||
                        metadata.userId === null ||
                        useAuthStore.getState().user?.id !== metadata.userId
                      )
                        return;
                      setManaging({
                        collection: metadata.collection,
                        ownerId: metadata.userId,
                        generation: getAuthSessionGeneration(),
                      });
                    }}
                  >
                    <MaterialCommunityIcons
                      name="dots-horizontal"
                      size={22}
                      color={theme.extends.colors.text.secondary}
                      accessible={false}
                    />
                  </SafePressable>
                )}
              </View>
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
            {item.availability === "unavailable" ? (
              <View className="flex-row items-center gap-3 rounded-card border border-border-primary bg-surface px-4 py-4">
                <View className="min-w-0 flex-1">
                  <AppText
                    weight="semibold"
                    className="text-base text-text-primary"
                  >
                    {item.business_name}
                  </AppText>
                  <AppText className="mt-1 text-sm text-text-secondary">
                    Currently unavailable
                  </AppText>
                  <AppText className="mt-1 text-xs text-text-secondary">
                    This business listing is currently unavailable. Your save
                    has been preserved.
                  </AppText>
                </View>
                <SafePressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.business_name} from this Pocket`}
                  className="min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
                  onPress={() => {
                    if (metadata.userId === null || collectionId === null)
                      return;
                    setRemoving({
                      collectionId,
                      business: item,
                      ownerId: metadata.userId,
                      generation: getAuthSessionGeneration(),
                    });
                  }}
                >
                  <MaterialCommunityIcons
                    name="bookmark-remove-outline"
                    size={22}
                    color={theme.extends.colors.text.secondary}
                    accessible={false}
                  />
                </SafePressable>
              </View>
            ) : (
              <BusinessCard
                business={item}
                variant="compact"
                distance={null}
                distanceAccuracy={null}
                onPress={() =>
                  router.push({
                    pathname: "/(explorer)/business/[businessId]",
                    params: {
                      businessId: String(item.id),
                      previewQueryHash: hashKey(
                        pocketCollectionBusinessesQueryKey(
                          contents.userId,
                          collectionId,
                        ),
                      ),
                    },
                  })
                }
                compactTrailingAction={
                  <SafePressable
                    accessibilityRole="button"
                    accessibilityLabel={`Options for ${item.business_name}`}
                    className="h-12 w-12 items-center justify-center rounded-full active:bg-surface-muted"
                    onPress={() => {
                      if (
                        !canShowContents ||
                        metadata.userId === null ||
                        !isValidId
                      )
                        return;
                      setBusinessAction({
                        collectionId,
                        business: item,
                        ownerId: metadata.userId,
                        generation: getAuthSessionGeneration(),
                      });
                    }}
                  >
                    <MaterialCommunityIcons
                      name="dots-horizontal"
                      size={22}
                      color={theme.extends.colors.text.secondary}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    />
                  </SafePressable>
                }
              />
            )}
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
            ) : !contents.hasNextPage &&
              !contents.isFetching &&
              businesses.length >= 5 ? (
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
      {canShowContents &&
        managing &&
        managing.ownerId === metadata.userId &&
        managing.collection.id === collectionId &&
        managing.generation === getAuthSessionGeneration() && (
          <PocketCollectionActions
            key={`${managing.ownerId}:${managing.generation}:${managing.collection.id}`}
            collection={managing.collection}
            onClose={() => setManaging(null)}
            onDeleted={() => router.replace("/(explorer)/profile/my-pockets")}
          />
        )}
      {canShowContents &&
        businessAction &&
        businessAction.collectionId === collectionId &&
        businessAction.ownerId === metadata.userId &&
        businessAction.generation === getAuthSessionGeneration() && (
          <PocketBusinessActions
            {...businessAction}
            onRemove={() => setRemoving(businessAction)}
            onClose={() => setBusinessAction(null)}
          />
        )}
      {canShowContents &&
        removing &&
        removing.collectionId === collectionId &&
        removing.ownerId === metadata.userId &&
        removing.generation === getAuthSessionGeneration() && (
          <PocketBusinessRemovalConfirmation
            key={`${removing.ownerId}:${removing.generation}:${removing.collectionId}:${removing.business.id}`}
            {...removing}
            onClose={() => setRemoving(null)}
          />
        )}
    </SafeAreaView>
  );
}
