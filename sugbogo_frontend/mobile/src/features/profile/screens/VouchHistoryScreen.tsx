import { onlineManager } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import LottieView from "lottie-react-native";
import { useCallback, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import useBusinessVouch from "@/features/explore/hooks/useBusinessVouch";
import type { ExploreBusinessSpecialtyTag } from "@/features/explore/types/exploreBusiness.types";
import MerchantMetricCard from "@/features/merchant/components/MerchantMetricCard";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import SegmentedControl, {
  type SegmentedControlOption,
} from "@/shared/components/SegmentedControl";
import Skeleton from "@/shared/components/Skeleton";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import ManageVouchBottomSheet from "../components/vouch-history/ManageVouchBottomSheet";
import VouchHistoryEmptyState from "../components/vouch-history/VouchHistoryEmptyState";
import VouchHistoryItem from "../components/vouch-history/VouchHistoryItem";
import VouchHistorySkeleton from "../components/vouch-history/VouchHistorySkeleton";
import useVouchHistory from "../hooks/useVouchHistory";
import type {
  VouchHistoryBusiness,
  VouchHistoryOrdering,
} from "../types/vouchHistory.types";

/** Minimum row count before the end-of-list message appears. */
const END_MESSAGE_MIN_ITEMS = 5;

const SORT_OPTIONS: SegmentedControlOption<VouchHistoryOrdering>[] = [
  {
    value: "newest",
    label: "Newest",
    icon: "sort-calendar-descending",
    accessibilityLabel: "Sort history by Newest",
  },
  {
    value: "oldest",
    label: "Oldest",
    icon: "sort-calendar-ascending",
    accessibilityLabel: "Sort history by Oldest",
  },
];

const keyExtractor = (business: VouchHistoryBusiness) => String(business.id);

function VouchSeparator() {
  return <View className="mx-4 h-px bg-border-primary" />;
}

/**
 * Displays backend-grouped vouch history and full-history totals.
 *
 * Presents illustrated summary cards consistent with Merchant Business
 * Overview while preserving pagination, sorting, refresh, and vouch management.
 *
 * Uses the shared SegmentedControl for sorting history entries.
 */
export default function VouchHistoryScreen() {
  const [ordering, setOrdering] = useState<VouchHistoryOrdering>("newest");

  const [selectedBusiness, setSelectedBusiness] =
    useState<VouchHistoryBusiness | null>(null);

  const nextPagePendingRef = useRef(false);
  const listRef = useRef<FlatList<VouchHistoryBusiness>>(null);

  // The hook captures each request's business independently of later selections.
  const { vouch } = useBusinessVouch({
    businessId: selectedBusiness?.business_id ?? 0,
  });

  const history = useVouchHistory(ordering);
  const insets = useSafeAreaInsets();

  useQueryErrorNotification({
    error: history.error,
    toastId: "vouch-history-error",
    title: "Unable to load your vouches",
    fallbackMessage: "Please try again.",
  });

  // Update ordering and return to the beginning of the history list.
  const changeOrdering = useCallback(
    (value: VouchHistoryOrdering) => {
      if (value === ordering) return;

      setOrdering(value);
      listRef.current?.scrollToOffset({
        offset: 0,
        animated: false,
      });
    },
    [ordering],
  );

  // Add or remove a specialty vouch for the selected business.
  async function toggleSpecialty(
    tag: ExploreBusinessSpecialtyTag,
    onAccepted?: () => void,
  ) {
    if (!selectedBusiness) return;
    if (!onlineManager.isOnline()) {
      Toast.show({
        type: "info",
        text1: "Internet connection required",
        text2: "Connect to the internet to update your vouches.",
      });
      return;
    }
    try {
      await vouch(
        {
          tagId: tag.id,
          isVouched: tag.is_vouched,
        },
        onAccepted,
      );
    } catch (error) {
      const response = error as ApiResponse<unknown>;

      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to update vouch",
          text2: response.message || "Please try again.",
        });
      }
    }
  }

  // Load the next page without triggering duplicate requests.
  function loadNextPage() {
    if (
      nextPagePendingRef.current ||
      history.isFetching ||
      !history.hasNextPage
    ) {
      return;
    }

    nextPagePendingRef.current = true;

    void history.fetchNextPage().finally(() => {
      nextPagePendingRef.current = false;
    });
  }

  // Keep the row renderer stable across screen updates.
  const renderItem = useCallback(
    ({ item }: { item: VouchHistoryBusiness }) => (
      <VouchHistoryItem
        business={item}
        onManage={() => setSelectedBusiness(item)}
        onOpenBusiness={() =>
          router.push({
            pathname: "/(explorer)/business/[businessId]",
            params: {
              businessId: String(item.business_id),
            },
          })
        }
      />
    ),
    [],
  );

  const hasLoadedData = history.hasData;

  const initialError = Boolean(history.error) && !hasLoadedData;

  const refreshError =
    Boolean(history.error) && hasLoadedData && !history.isFetchNextPageError;

  const showEnd =
    history.businesses.length >= END_MESSAGE_MIN_ITEMS &&
    !history.hasNextPage &&
    !history.isFetching &&
    !history.error;

  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-surface">
      {/* Screen navigation */}
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          title: "My Vouches",
        }}
      />

      {/* Summary totals and sorting controls */}
      <View className="px-4 pb-4 pt-4">
        {history.summary ? (
          <View className="flex-row gap-3">
            <MerchantMetricCard
              icon="storefront-outline"
              label="Businesses vouched"
              value={history.summary.total_businesses.toLocaleString()}
              stacked={false}
              testID="history-business-total"
            />

            <MerchantMetricCard
              icon="heart-outline"
              label="Specialty vouches"
              value={history.summary.total_specialty_vouches.toLocaleString()}
              stacked={false}
              testID="history-specialty-total"
            />
          </View>
        ) : history.isLoading ? (
          <Skeleton className="h-12 w-4/5 rounded-md" />
        ) : null}

        <SegmentedControl
          options={SORT_OPTIONS}
          variant="sm"
          value={ordering}
          onChange={changeOrdering}
          className="mt-4"
        />
      </View>

      {/* Paginated business history and request recovery */}
      <FlatList
        ref={listRef}
        testID="vouch-history-list"
        data={history.businesses}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={VouchSeparator}
        renderItem={renderItem}
        ListHeaderComponent={
          refreshError ? (
            <View className="mb-3">
              <ErrorState
                size="section"
                title="Unable to refresh history"
                description="Your loaded history is still available."
                primaryActionTitle="Retry"
                onPrimaryAction={() => void history.refetch()}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          history.isLoading ? (
            <VouchHistorySkeleton />
          ) : initialError ? (
            <View className="min-h-[360px]">
              <ErrorState
                title="Unable to load your vouches"
                description="Please try again to load your endorsements."
                primaryActionTitle="Retry"
                onPrimaryAction={() => void history.refetch()}
              />
            </View>
          ) : (
            <VouchHistoryEmptyState />
          )
        }
        ListFooterComponent={
          history.isFetchingNextPage ? (
            <View
              className="items-center py-5"
              testID="vouch-history-page-loader"
            >
              <LottieView
                source={loadingAnimation}
                autoPlay
                loop
                style={{
                  width: 50,
                  height: 50,
                }}
              />
            </View>
          ) : history.isFetchNextPageError ? (
            <ErrorState
              size="section"
              title="Unable to load more history"
              description="Your loaded businesses are still available."
              primaryActionTitle="Retry next page"
              onPrimaryAction={loadNextPage}
            />
          ) : showEnd ? (
            <EndOfListMessage />
          ) : null
        }
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 24),
        }}
        onEndReached={() => {
          if (!history.isFetchNextPageError) {
            loadNextPage();
          }
        }}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching && !history.isFetchingNextPage}
            onRefresh={() => {
              if (!history.isFetching) {
                void history.refetch();
              }
            }}
            tintColor={theme.extends.colors.brand}
          />
        }
      />

      {/* Screen-owned vouch management */}
      {selectedBusiness && (
        <ManageVouchBottomSheet
          key={selectedBusiness.business_id}
          selectedBusiness={selectedBusiness}
          onToggleSpecialty={toggleSpecialty}
          onDismiss={() => setSelectedBusiness(null)}
        />
      )}
    </SafeAreaView>
  );
}
