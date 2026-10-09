import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import LottieView from "lottie-react-native";
import { useRef } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { theme } from "@/constants/theme";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

import LocationChangeRequestCard from "../../components/location-change/LocationChangeRequestCard";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import { useMerchantLocationChangeRequests } from "../../hooks/location-change/useMerchantLocationChanges";
import type { LocationChangeRequest } from "../../types/locationChange.types";

/**
 * Displays the merchant's location change request history.
 *
 * Provides a compact reference to the current business location,
 * navigates to request details, and supports paginated history,
 * pull-to-refresh, and request creation.
 */
export default function LocationChangeHistoryScreen() {
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
  } = useMerchantLocationChangeRequests();

  useQueryErrorNotification({
    error,
    toastId: "location-change-history-error",
    title: "Unable to load location requests",
    fallbackMessage: "Please try again.",
  });

  function openRequest(request: LocationChangeRequest) {
    router.push(
      `/(merchant)/business-update-requests/location/${request.id}` as Href,
    );
  }

  function loadNextPage() {
    if (momentumHandled.current || !hasNextPage || isFetchingNextPage) {
      return;
    }

    momentumHandled.current = true;
    void fetchNextPage();
  }

  // Initial history loading.
  if (isLoading && requests.length === 0) {
    return (
      <View className="flex-1 bg-surface px-5 pt-5">
        <View className="rounded-2xl border border-border-primary/70 bg-surface p-4">
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="mt-3 h-5 w-56 rounded-md" />
        </View>

        <Skeleton className="mt-6 h-5 w-36 rounded-md" />

        {[1, 2, 3].map((item) => (
          <View
            key={item}
            className="mt-4 rounded-2xl border border-border-primary/70 bg-surface p-4"
          >
            <Skeleton className="h-5 w-40 rounded-md" />
            <View className="mt-4 border-t border-border-primary/60 pt-4">
              <Skeleton className="h-5 w-48 rounded-md" />
              <Skeleton className="mt-3 h-4 w-52 rounded-md" />
            </View>
            <Skeleton className="mt-4 h-4 w-32 rounded-md" />
          </View>
        ))}
      </View>
    );
  }

  // Unavailable history.
  if (error && requests.length === 0) {
    return (
      <ErrorState
        title="Unable to load location requests"
        description="Please try again."
        primaryActionTitle="Retry"
        onPrimaryAction={() => void refetch()}
        secondaryActionTitle="Go Back"
        onSecondaryAction={() => router.back()}
      />
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <FlatList
        testID="location-change-history-list"
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
          <View className="mb-5">
            {/* Recoverable history refresh error */}
            {error ? (
              <View className="mb-4">
                <ErrorState
                  size="section"
                  title="Unable to refresh location requests"
                  description="Showing the last available history."
                  primaryActionTitle="Retry"
                  onPrimaryAction={() => void refetch()}
                />
              </View>
            ) : null}

            {/* Compact current business location */}
            {business ? (
              <View className="flex-row items-center gap-3 rounded-2xl border border-border-primary/70 bg-surface p-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface">
                  <MaterialCommunityIcons
                    name="map-marker-outline"
                    size={22}
                    color={theme.extends.colors.text.secondary}
                  />
                </View>

                <View className="min-w-0 flex-1">
                  <AppText className="text-xs text-text-secondary">
                    Current business location
                  </AppText>

                  <AppText
                    weight="semibold"
                    className="mt-1 text-sm text-text-primary"
                    numberOfLines={2}
                  >
                    {business.location.address}
                  </AppText>
                </View>
              </View>
            ) : null}

            {/* New location request action */}
            {business?.status === "active" && !pendingRequest ? (
              <Button
                title="Request location change"
                rounded="full"
                className="mt-4"
                onPress={() =>
                  router.push("/(merchant)/location-change" as Href)
                }
              />
            ) : business?.status === "suspended" ? (
              <AppText className="mt-3 text-xs leading-5 text-text-secondary">
                Location changes are unavailable while your business is
                suspended.
              </AppText>
            ) : null}

            {/* History section heading */}
            <View className="mt-6">
              <AppText weight="bold" className="text-base text-text-primary">
                Request history
              </AppText>

              <AppText className="mt-1 text-xs leading-5 text-text-secondary">
                Track your submitted location and landmark changes.
              </AppText>
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => (
          <LocationChangeRequestCard
            request={item}
            onPress={() => openRequest(item)}
          />
        )}
        ListEmptyComponent={
          <View className="items-center px-6 py-10">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-surface">
              <MaterialCommunityIcons
                name="clipboard-text-outline"
                size={26}
                color={theme.extends.colors.text.tertiary}
              />
            </View>

            <AppText
              weight="semibold"
              className="mt-4 text-center text-base text-text-primary"
            >
              No location requests yet
            </AppText>

            <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
              Your submitted location changes and their review status will
              appear here.
            </AppText>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="items-center py-5" testID="location-page-loader">
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
