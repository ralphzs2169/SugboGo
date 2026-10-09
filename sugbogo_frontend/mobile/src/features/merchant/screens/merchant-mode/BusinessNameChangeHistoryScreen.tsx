import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import LottieView from "lottie-react-native";
import { useRef, useState } from "react";
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

import BusinessNameChangeRequestCard from "../../components/business-name-change/BusinessNameChangeRequestCard";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import { useMerchantBusinessNameChangeRequests } from "../../hooks/business-name-change/useMerchantBusinessNameChanges";
import type { BusinessNameChangeRequest } from "../../types/businessNameChange.types";

const MASCOT_NO_HISTORY = require("@/shared/assets/mascot/mascot-no-business-name-changes.webp");

/**
 * Displays the merchant's current business name and change request history.
 *
 * Uses the business cover photo with a storefront fallback, provides a
 * contextual request action, and supports paginated history, pull-to-refresh,
 * recoverable loading errors, and an illustrated empty state.
 */
export default function BusinessNameChangeHistoryScreen() {
  const insets = useSafeAreaInsets();
  const momentumHandled = useRef(false);
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);

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
  } = useMerchantBusinessNameChangeRequests();

  const hasHistory = requests.length > 0;
  const coverPhotoUrl = business?.cover_photo_url;
  const showCoverPhoto = Boolean(
    coverPhotoUrl && coverPhotoUrl !== failedCoverUrl,
  );

  useQueryErrorNotification({
    error,
    toastId: "business-name-change-history-error",
    title: "Unable to load name requests",
    fallbackMessage: "Please try again.",
  });

  useQueryErrorNotification({
    error: profileError,
    toastId: "name-history-business-error",
    title: "Unable to load business details",
    fallbackMessage: "Please try again.",
  });

  function openRequest(request: BusinessNameChangeRequest) {
    router.push(`/(merchant)/business-update-requests/${request.id}` as Href);
  }

  function openNewRequest() {
    router.push("/(merchant)/business-name-change" as Href);
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
        {/* Current business identity skeleton */}
        <View className="rounded-2xl border border-border-primary/70 bg-surface p-4">
          <View className="flex-row items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-xl" />

            <View className="min-w-0 flex-1">
              <Skeleton className="h-3 w-32 rounded-md" />
              <Skeleton className="mt-3 h-5 w-44 max-w-full rounded-md" />
            </View>
          </View>

          <Skeleton className="mt-4 h-10 w-52 rounded-full" />
        </View>

        {/* Request history skeleton */}
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
      <View className="flex-1 bg-surface">
        <ErrorState
          title="Unable to load name requests"
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
    <View className="flex-1 bg-surface">
      <FlatList
        testID="business-name-change-history-list"
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
            {/* Recoverable request history error */}
            {error ? (
              <View className="mb-4">
                <ErrorState
                  size="section"
                  title="Unable to refresh name requests"
                  description="Showing the last available history."
                  primaryActionTitle="Retry"
                  onPrimaryAction={() => void refetch()}
                />
              </View>
            ) : null}

            {/* Recoverable business profile error */}
            {profileError ? (
              <View className="mb-4">
                <ErrorState
                  size="section"
                  title="Unable to load business details"
                  description={
                    business
                      ? "Showing the last available business details."
                      : "Please try loading your business information again."
                  }
                  primaryActionTitle="Retry"
                  onPrimaryAction={() => void refetchProfile()}
                />
              </View>
            ) : null}

            {/* Current business name and request action */}
            {business ? (
              <View className="rounded-2xl border border-border-primary/70 bg-surface p-4">
                {/* Compact business identity */}
                <View className="flex-row items-center gap-3">
                  {showCoverPhoto && coverPhotoUrl ? (
                    <Image
                      source={{ uri: coverPhotoUrl }}
                      style={{ width: 56, height: 56, borderRadius: 12 }}
                      contentFit="cover"
                      accessibilityLabel="Business cover photo"
                      onError={() => setFailedCoverUrl(coverPhotoUrl)}
                    />
                  ) : (
                    <View
                      testID="business-cover-fallback"
                      className="h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-background"
                    >
                      <MaterialCommunityIcons
                        name="storefront-outline"
                        size={28}
                        color={theme.extends.colors.text.secondary}
                      />
                    </View>
                  )}

                  <View className="min-w-0 flex-1">
                    <AppText className="text-xs text-text-secondary">
                      {profileError
                        ? "Last known business name"
                        : "Current business name"}
                    </AppText>

                    <AppText
                      weight="semibold"
                      className="mt-1 text-lg leading-6 text-text-primary"
                      numberOfLines={3}
                    >
                      {business.business_name}
                    </AppText>
                  </View>
                </View>

                {/* Contextual request action */}
                {business.status === "active" && !pendingRequest ? (
                  <View className="mt-4 w-[220px] max-w-full">
                    <Button
                      title="Request Name Change"
                      rounded="full"
                      size="sm"
                      onPress={openNewRequest}
                    />
                  </View>
                ) : business.status === "suspended" ? (
                  <View className="mt-3 flex-row items-start gap-2">
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={17}
                      color={theme.extends.colors.text.secondary}
                    />

                    <AppText className="flex-1 text-xs leading-5 text-text-secondary">
                      Name changes are unavailable while your business is
                      suspended.
                    </AppText>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Request history heading */}
            <View className="mt-6">
              <View className="flex-row items-center gap-1.5">
                <AppText weight="bold" className="text-base text-text-primary">
                  Request history
                </AppText>

                {typeof totalRequests === "number" && totalRequests > 0 ? (
                  <AppText
                    testID="history-count"
                    weight="medium"
                    className="text-sm text-text-secondary"
                  >
                    ({totalRequests})
                  </AppText>
                ) : null}
              </View>

              {hasHistory ? (
                <AppText className="mt-1 text-xs leading-5 text-text-secondary">
                  Track your submitted business name changes.
                </AppText>
              ) : null}
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => (
          <BusinessNameChangeRequestCard
            request={item}
            onPress={() => openRequest(item)}
          />
        )}
        ListEmptyComponent={
          <View className="items-center px-3 pb-6 pt-3">
            {/* Empty history mascot */}
            <Image
              source={MASCOT_NO_HISTORY}
              style={{ width: 120, height: 120 }}
              contentFit="contain"
              accessible
              accessibilityLabel="SugboGo mascot showing an empty business name change request history"
            />

            {/* Empty history message */}
            <AppText
              weight="semibold"
              className="mt-2 text-center text-base text-text-primary"
            >
              No name change requests yet
            </AppText>

            <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
              When you request a business name change, its progress will appear
              here.
            </AppText>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="items-center py-5" testID="request-page-loader">
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
