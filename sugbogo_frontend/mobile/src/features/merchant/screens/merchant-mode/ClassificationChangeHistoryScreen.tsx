import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import LottieView from "lottie-react-native";
import { useRef } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

import ClassificationChangeRequestCard from "../../components/classification-change/ClassificationChangeRequestCard";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import { useMerchantClassificationChangeRequests } from "../../hooks/classification-change/useMerchantClassificationChanges";
import useSpecialtyTags from "../../hooks/registration/useSpecialtyTags";
import useClusters from "../../hooks/registration/useClusters";
import type { ClassificationChangeRequest } from "../../types/classificationChange.types";

const MASCOT_NO_HISTORY = require("@/shared/assets/mascot/mascot-no-classifcation-changes.webp");

/**
 * Displays the merchant's live classification and change request history.
 *
 * Shows the current cluster, category, and specialty tags alongside
 * a contextual request action. Supports paginated history, pull-to-refresh,
 * recoverable errors, and a dedicated empty-state illustration.
 */
export default function ClassificationChangeHistoryScreen() {
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
  } = useMerchantClassificationChangeRequests();

  const { specialtyTags } = useSpecialtyTags();
  const { clusters } = useClusters();
  const clusterIcon = clusters.find(
    (cluster) => cluster.id === business?.cluster?.id,
  )?.icon;
  const currentClusterIconName =
    CLUSTER_ICONS[clusterIcon ?? ""] ?? "shape-outline";

  const hasHistory = requests.length > 0;

  const liveSpecialtyTags = business?.specialty_tags ?? [];

  const specialtyTagLookup = new Map(
    specialtyTags.map((tag) => [Number(tag.id), tag]),
  );

  useQueryErrorNotification({
    error,
    toastId: "classification-change-history-error",
    title: "Unable to load classification requests",
    fallbackMessage: "Please try again.",
  });

  useQueryErrorNotification({
    error: profileError,
    toastId: "classification-history-business-error",
    title: "Unable to load business classification",
    fallbackMessage: "Please try again.",
  });

  function openRequest(request: ClassificationChangeRequest) {
    router.push(
      `/(merchant)/business-update-requests/classification/${request.id}` as Href,
    );
  }

  function openNewRequest() {
    router.push("/(merchant)/classification-change" as Href);
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
        {/* Live classification skeleton */}
        <View className="rounded-2xl border border-border-primary/70 bg-surface p-4">
          <View className="flex-row items-start gap-3">
            <Skeleton className="h-11 w-11 rounded-xl" />

            <View className="flex-1">
              <Skeleton className="h-3 w-36 rounded-md" />
              <Skeleton className="mt-3 h-5 w-48 rounded-md" />
              <Skeleton className="mt-2 h-3 w-28 rounded-md" />
            </View>
          </View>

          <View className="mt-4 border-t border-border-primary/60 pt-3">
            <Skeleton className="h-3 w-24 rounded-md" />

            <View className="mt-3 flex-row gap-2">
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-full" />
            </View>
          </View>

          <Skeleton className="mt-5 h-10 w-60 rounded-full" />
        </View>

        {/* History skeleton */}
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
    <View className="flex-1 bg-surface">
      <FlatList
        testID="classification-change-history-list"
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
                  title="Unable to refresh classification requests"
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
                  title="Unable to load business classification"
                  description={
                    business
                      ? "Showing the last available classification."
                      : "Please try loading your business information again."
                  }
                  primaryActionTitle="Retry"
                  onPrimaryAction={() => void refetchProfile()}
                />
              </View>
            ) : null}

            {/* Current live classification and contextual action */}
            {business ? (
              <View className="rounded-2xl border border-border-primary/70 bg-surface p-4">
                {/* Cluster and category */}
                <View className="flex-row items-start gap-3">
                  <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                    <MaterialCommunityIcons
                      testID="current-cluster-icon"
                      name={currentClusterIconName}
                      accessibilityLabel={`Current cluster icon: ${currentClusterIconName}`}
                      size={23}
                      color={theme.extends.colors.brand}
                    />
                  </View>

                  <View className="min-w-0 flex-1">
                    <AppText className="text-xs text-text-secondary">
                      {profileError
                        ? "Last known classification"
                        : "Current classification"}
                    </AppText>

                    <AppText
                      weight="semibold"
                      className="mt-1 text-base leading-6 text-text-primary"
                    >
                      {business.category.name}
                    </AppText>

                    {business.cluster?.name ? (
                      <AppText className="mt-0.5 text-xs text-text-secondary">
                        {business.cluster.name}
                      </AppText>
                    ) : null}
                  </View>
                </View>

                {/* Current live specialty tags */}
                <View className="mt-4 border-t border-border-primary/60 pt-3">
                  <View className="flex-row items-center justify-between">
                    <AppText
                      weight="medium"
                      className="text-xs text-text-secondary"
                    >
                      Specialty tags
                    </AppText>
                  </View>

                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {liveSpecialtyTags.map((tag) => {
                      const catalogTag = specialtyTagLookup.get(Number(tag.id));

                      return catalogTag ? (
                        <SpecialtyTagChip
                          key={tag.id}
                          tag={catalogTag}
                          size="small"
                          showIcon
                        />
                      ) : (
                        <View
                          key={tag.id}
                          className="rounded-full border border-border-primary bg-background px-3 py-1.5"
                        >
                          <AppText className="text-xs text-text-secondary">
                            {tag.name}
                          </AppText>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Contextual request action */}
                {business.status === "suspended" ? (
                  <View className="mt-4 flex-row items-start gap-2">
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={17}
                      color={theme.extends.colors.text.secondary}
                    />

                    <AppText className="flex-1 text-xs leading-5 text-text-secondary">
                      Classification changes are unavailable while your business
                      is suspended.
                    </AppText>
                  </View>
                ) : business.status === "active" && !pendingRequest ? (
                  <View className="mt-5 w-[250px] max-w-full">
                    <Button
                      title="Request Classification Change"
                      rounded="full"
                      size="sm"
                      onPress={openNewRequest}
                    />
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
                    weight="bold"
                    className="text-sm text-text-primary"
                  >
                    ({totalRequests})
                  </AppText>
                ) : null}
              </View>

              {hasHistory ? (
                <AppText className="mt-1 text-xs leading-5 text-text-secondary">
                  Track your category and specialty tag change requests.
                </AppText>
              ) : null}
            </View>
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
          <View className="items-center px-3 pb-6 pt-3">
            {/* Empty history mascot */}
            <Image
              source={MASCOT_NO_HISTORY}
              style={{ width: 120, height: 120 }}
              contentFit="contain"
              accessible
              accessibilityLabel="SugboGo mascot showing an empty classification change request history"
            />

            {/* Empty history message */}
            <AppText
              weight="semibold"
              className="mt-2 text-center text-base text-text-primary"
            >
              No classification requests yet
            </AppText>

            <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
              When you request a category or specialty tag change, its progress
              will appear here.
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
