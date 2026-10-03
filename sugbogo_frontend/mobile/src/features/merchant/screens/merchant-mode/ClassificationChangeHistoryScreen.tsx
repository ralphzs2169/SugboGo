import { router, type Href } from "expo-router";
import LottieView from "lottie-react-native";
import { useRef } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";

import { theme } from "@/constants/theme";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import AppText from "@/shared/components/AppText";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

import ClassificationChangeRequestCard from "../../components/classification-change/ClassificationChangeRequestCard";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import { useMerchantClassificationChangeRequests } from "../../hooks/classification-change/useMerchantClassificationChanges";
import type { ClassificationChangeRequest } from "../../types/classificationChange.types";

/** Shows pending classification work and backend-paginated request history. */
export default function ClassificationChangeHistoryScreen() {
  const momentumHandled = useRef(false);
  const { business } = useMerchantBusinessProfile();
  const {
    requests,
    pendingRequest,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useMerchantClassificationChangeRequests();

  useQueryErrorNotification({
    error,
    toastId: "classification-change-history-error",
    title: "Unable to load classification requests",
    fallbackMessage: "Please try again.",
  });

  function openRequest(request: ClassificationChangeRequest) {
    router.push(
      `/(merchant)/business-update-requests/classification/${request.id}` as Href,
    );
  }

  function loadNextPage() {
    if (momentumHandled.current || !hasNextPage || isFetchingNextPage) {
      return;
    }
    momentumHandled.current = true;
    void fetchNextPage();
  }

  if (isLoading && requests.length === 0) {
    return (
      <View className="flex-1 bg-background px-5 pt-5">
        {/* History loading skeleton */}
        <Skeleton className="h-5 w-52 rounded-md" />
        {[1, 2, 3].map((item) => (
          <View
            key={item}
            className="mt-4 rounded-card border border-border-primary bg-surface p-4"
          >
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="mt-4 h-4 w-56 rounded-md" />
            <Skeleton className="mt-4 h-3 w-36 rounded-md" />
          </View>
        ))}
      </View>
    );
  }

  if (error && requests.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          title="Unable to load classification requests"
          description="Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={() => void refetch()}
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <FlatList
        testID="classification-change-history-list"
        data={requests}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="px-5 pt-5"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => void refetch()}
            tintColor={theme.extends.colors.brand}
          />
        }
        ListHeaderComponent={
          <View className="mb-4">
            {error ? (
              <ErrorState
                size="section"
                title="Unable to refresh classification requests"
                description="Showing the last available history."
                primaryActionTitle="Retry"
                onPrimaryAction={() => void refetch()}
              />
            ) : null}
            {/* Current live classification and request availability */}
            {business ? (
              <View className="rounded-card border border-border-primary bg-surface p-4">
                <AppText className="text-xs text-text-secondary">
                  Current live category
                </AppText>
                <AppText
                  weight="bold"
                  className="mt-1 text-base text-text-primary"
                >
                  {business.category.name}
                </AppText>
              </View>
            ) : null}
            <AppText className="mt-4 text-sm leading-5 text-text-secondary">
              Requested classification becomes live only after Admin approval.
            </AppText>
            {business?.status === "suspended" ? (
              <AppText className="mt-3 text-xs text-text-secondary">
                Classification changes cannot be requested while your business
                is suspended.
              </AppText>
            ) : !pendingRequest && business?.status === "active" ? (
              <Pressable
                onPress={() =>
                  router.push("/(merchant)/classification-change" as Href)
                }
                accessibilityRole="button"
                className="cursor-pointer mt-3 min-h-11 items-center justify-center rounded-xl bg-brand px-4 active:opacity-75"
              >
                <AppText weight="bold" className="text-sm text-white">
                  Request classification change
                </AppText>
              </Pressable>
            ) : null}
            <AppText weight="bold" className="mt-5 text-base text-text-primary">
              Classification Requests
            </AppText>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => (
          <ClassificationChangeRequestCard
            request={item}
            onPress={() => openRequest(item)}
          />
        )}
        ListEmptyComponent={
          <View className="items-center px-6 py-10">
            <AppText weight="semibold" className="text-base text-text-primary">
              No classification change requests yet.
            </AppText>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View
              className="items-center py-5"
              testID="classification-page-loader"
            >
              <LottieView
                source={loadingAnimation}
                autoPlay
                loop
                style={{ width: 50, height: 50 }}
              />
            </View>
          ) : !hasNextPage && requests.length > 5 ? (
            <EndOfListMessage description="You've reached the end of your requests." />
          ) : null
        }
        onEndReached={loadNextPage}
        onEndReachedThreshold={0.35}
        onMomentumScrollBegin={() => {
          momentumHandled.current = false;
        }}
      />
    </View>
  );
}
