import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import LottieView from "lottie-react-native";
import { useRef } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

import LocationChangeRequestCard from "../../components/location-change/LocationChangeRequestCard";
import LocationPickerMap from "../../components/registration/location/LocationPickerMap";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import { useMerchantLocationChangeRequests } from "../../hooks/location-change/useMerchantLocationChanges";
import type { LocationChangeRequest } from "../../types/locationChange.types";

const MASCOT_NO_HISTORY = require("@/shared/assets/mascot/mascot-no-location-changes.webp");

/**
 * Displays the merchant's live location and location change request history.
 *
 * Groups the read-only location map, address, and contextual request action
 * inside one card. Supports paginated history, pull-to-refresh, recoverable
 * data-loading errors, and a dedicated empty state.
 */
export default function LocationChangeHistoryScreen() {
  const insets = useSafeAreaInsets();
  const momentumHandled = useRef(false);

  const {
    business,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useMerchantBusinessProfile();

  const {
    requests,
    totalRequests,
    pendingRequest,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useMerchantLocationChangeRequests();

  const hasHistory = requests.length > 0;

  useQueryErrorNotification({
    error,
    toastId: "location-change-history-error",
    title: "Unable to load location requests",
    fallbackMessage: "Please try again.",
  });

  useQueryErrorNotification({
    error: profileError,
    toastId: "location-history-business-error",
    title: "Unable to load business location",
    fallbackMessage: "Please try again.",
  });

  function openRequest(request: LocationChangeRequest) {
    router.push(
      `/(merchant)/business-update-requests/location/${request.id}` as Href,
    );
  }

  function openNewRequest() {
    router.push("/(merchant)/location-change" as Href);
  }

  function refreshHistory() {
    void Promise.all([refetch(), refetchProfile()]);
  }

  function loadNextPage() {
    if (momentumHandled.current || !hasNextPage || isFetchingNextPage) {
      return;
    }

    momentumHandled.current = true;
    void fetchNextPage();
  }

  // Initial loading state
  if ((isLoading && !hasHistory) || (isProfileLoading && !business)) {
    return (
      <View className="flex-1 bg-surface px-5 pt-4">
        {/* Live-location card skeleton */}
        <View className="overflow-hidden rounded-2xl border border-border-primary/70 bg-surface">
          <Skeleton className="h-36 w-full rounded-none" />

          <View className="p-4">
            <Skeleton className="h-3 w-36 rounded-md" />
            <Skeleton className="mt-3 h-5 w-52 rounded-md" />
            <Skeleton className="mt-2 h-3 w-32 rounded-md" />

            <Skeleton className="mt-4 h-10 w-56 rounded-full" />
          </View>
        </View>

        {/* Request-history skeleton */}
        <Skeleton className="mt-7 h-5 w-36 rounded-md" />

        {[1, 2].map((item) => (
          <View
            key={item}
            className="mt-4 rounded-2xl border border-border-primary/70 bg-surface p-4"
          >
            <Skeleton className="h-4 w-32 rounded-md" />

            <View className="mt-4 border-t border-border-primary/60 pt-4">
              <Skeleton className="h-5 w-48 rounded-md" />
              <Skeleton className="mt-3 h-4 w-52 rounded-md" />
            </View>

            <Skeleton className="mt-4 h-3 w-32 rounded-md" />
          </View>
        ))}
      </View>
    );
  }

  // Unavailable request history
  if (error && !hasHistory) {
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
        contentContainerClassName="px-5 pt-4"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={refreshHistory}
            tintColor={theme.extends.colors.brand}
          />
        }
        ListHeaderComponent={
          <View className="mb-4">
            {/* Recoverable request-history error */}
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

            {/* Recoverable business-profile error */}
            {profileError ? (
              <View className="mb-4">
                <ErrorState
                  size="section"
                  title="Unable to load business location"
                  description={
                    business
                      ? "Showing the last available location."
                      : "Please try loading your business location again."
                  }
                  primaryActionTitle="Retry"
                  onPrimaryAction={() => void refetchProfile()}
                />
              </View>
            ) : null}

            {/* Live business location and contextual action */}
            {business ? (
              <View className="overflow-hidden rounded-2xl border border-border-primary/70 bg-surface">
                {/* Read-only map preview */}
                <LocationPickerMap
                  latitude={business.location.latitude}
                  longitude={business.location.longitude}
                  interactionEnabled={false}
                  showLocationPreviewOverlay={false}
                  previewHeight={145}
                />

                {/* Address details */}
                <View className="px-4 py-4">
                  <View className="flex-row items-center gap-2">
                    <MaterialCommunityIcons
                      name="map-marker-check-outline"
                      size={16}
                      color={theme.extends.colors.text.secondary}
                    />

                    <AppText
                      weight="medium"
                      className="text-xs text-text-secondary"
                    >
                      {profileError
                        ? "Last known live location"
                        : "Current business location"}
                    </AppText>
                  </View>

                  <AppText
                    weight="semibold"
                    className="mt-2 text-sm leading-5 text-text-primary"
                    numberOfLines={2}
                  >
                    {business.location.address}
                  </AppText>

                  <AppText className="mt-0.5 text-xs text-text-secondary">
                    {[business.location.city, business.location.province]
                      .filter(Boolean)
                      .join(", ")}
                  </AppText>

                  {/* Compact contextual action */}
                  {business.status === "suspended" ? (
                    <View className="mt-3 flex-row items-start gap-2">
                      <MaterialCommunityIcons
                        name="information-outline"
                        size={17}
                        color={theme.extends.colors.text.secondary}
                      />

                      <AppText className="flex-1 text-xs leading-5 text-text-secondary">
                        Location changes are unavailable while your business is
                        suspended.
                      </AppText>
                    </View>
                  ) : business.status === "active" && !pendingRequest ? (
                    <View className="mt-4 w-[240px] max-w-full">
                      <Button
                        title="Request Location Change"
                        rounded="full"
                        size="sm"
                        onPress={openNewRequest}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Request-history heading */}
            <View className="mt-6">
              <View className="flex-row items-center gap-1.5">
                <AppText weight="bold" className="text-base text-text-primary">
                  Request history
                </AppText>
                {typeof totalRequests === "number" && totalRequests > 0 ? (
                  <AppText
                    testID="history-count"
                    weight="bold"
                    className="text-sm text-text-primary"
                  >
                    ({totalRequests})
                  </AppText>
                ) : null}
              </View>

              {hasHistory ? (
                <AppText className="mt-1 text-xs leading-5 text-text-secondary">
                  Track your submitted location and landmark changes.
                </AppText>
              ) : null}
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
          <View className="items-center px-3 pb-6 pt-3">
            {/* Empty-history illustration */}
            <Image
              source={MASCOT_NO_HISTORY}
              style={{ width: 120, height: 120 }}
              contentFit="contain"
              accessible
              accessibilityLabel="SugboGo mascot showing an empty location request history"
            />

            {/* Empty-history message */}
            <AppText
              weight="semibold"
              className="mt-2 text-center text-base text-text-primary"
            >
              No location requests yet
            </AppText>

            <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
              When you request a location or landmark change, its progress will
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
