import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import LottieView from "lottie-react-native";
import type { ComponentProps, ComponentType } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, FlatList, RefreshControl, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import useBusinessVouch from "@/features/explore/hooks/useBusinessVouch";
import type { ExploreBusinessSpecialtyTag } from "@/features/explore/types/exploreBusiness.types";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import AppText from "@/shared/components/AppText";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import BusinessesVouchedIllustration from "../assets/businesses-vouched.svg";
import SpecialtyVouchesIllustration from "../assets/specialty-vouches.svg";
import ManageVouchBottomSheet from "../components/vouch-history/ManageVouchBottomSheet";
import VouchHistoryEmptyState from "../components/vouch-history/VouchHistoryEmptyState";
import VouchHistoryItem from "../components/vouch-history/VouchHistoryItem";
import VouchHistorySkeleton from "../components/vouch-history/VouchHistorySkeleton";
import useVouchHistory from "../hooks/useVouchHistory";
import type {
  VouchHistoryBusiness,
  VouchHistoryOrdering,
} from "../types/vouchHistory.types";
import { shadows } from "@/shared/styles/shadows";

/** Minimum row count before the "end of list" message is worth showing. */
const END_MESSAGE_MIN_ITEMS = 5;

/** Inner padding of the sort track, shared with the sliding thumb. */
const SORT_TRACK_PADDING = 4;

const SORT_OPTIONS: {
  value: VouchHistoryOrdering;
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
}[] = [
  { value: "newest", label: "Newest", icon: "sort-calendar-descending" },
  { value: "oldest", label: "Oldest", icon: "sort-calendar-ascending" },
];

const keyExtractor = (business: VouchHistoryBusiness) => String(business.id);

function VouchSeparator() {
  return <View className="mx-4 h-px bg-border-primary" />;
}

type SummaryCardProps = {
  Icon: ComponentType<{ width?: number; height?: number }>;
  label: string;
  value: number;
  testID: string;
};

/** Illustrated metric card used for the full-history totals. */
function SummaryCard({ Icon, label, value, testID }: SummaryCardProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="min-w-0 flex-1 rounded-2xl border border-border-primary/60 bg-surface p-4"
      style={shadows.subtle}
    >
      {/* Illustration, shown as-is without a background */}
      <View className="h-12 w-12 items-center justify-center">
        <Icon width={48} height={48} />
      </View>

      {/* Hero metric value */}
      <AppText
        weight="semibold"
        className="mt-4 text-text-primary"
        style={{ fontSize: 28, lineHeight: 34 }}
        testID={testID}
      >
        {value.toLocaleString()}
      </AppText>

      {/* Metric label */}
      <AppText className="mt-1 text-xs text-text-secondary" numberOfLines={2}>
        {label}
      </AppText>
    </View>
  );
}

type SortControlProps = {
  ordering: VouchHistoryOrdering;
  onChange: (value: VouchHistoryOrdering) => void;
};

/** Compact segmented control for choosing the history order. */
function SortControl({ ordering, onChange }: SortControlProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const thumbX = useRef(new Animated.Value(0)).current;

  const selectedIndex = SORT_OPTIONS.findIndex(
    (option) => option.value === ordering,
  );
  const segmentWidth = Math.max(
    (trackWidth - SORT_TRACK_PADDING * 2) / SORT_OPTIONS.length,
    0,
  );

  // Slide the thumb to the selected segment.
  useEffect(() => {
    Animated.timing(thumbX, {
      toValue: selectedIndex * segmentWidth,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [selectedIndex, segmentWidth, thumbX]);

  return (
    <View
      className="mt-4 flex-row rounded-full bg-surface-muted"
      style={{ padding: SORT_TRACK_PADDING }}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {/* Sliding selection thumb */}
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            shadows.subtle,
            {
              position: "absolute",
              top: SORT_TRACK_PADDING,
              bottom: SORT_TRACK_PADDING,
              left: SORT_TRACK_PADDING,
              width: segmentWidth,
              borderRadius: 999,
              backgroundColor: theme.extends.colors.surface,
              transform: [{ translateX: thumbX }],
            },
          ]}
        />
      )}

      {SORT_OPTIONS.map(({ value, label, icon }) => {
        const selected = ordering === value;

        return (
          <SafePressable
            key={value}
            onPress={() => onChange(value)}
            accessibilityLabel={`Sort history by ${label}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            hitSlop={{ top: 4, bottom: 4 }}
            className="min-h-[40px] min-w-0 flex-1 cursor-pointer flex-row items-center justify-center gap-xs rounded-full px-sm py-sm active:opacity-75"
          >
            <MaterialCommunityIcons
              name={icon}
              size={16}
              color={theme.extends.colors.brand}
              style={{ opacity: selected ? 1 : 0.45 }}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />

            <AppText
              weight={selected ? "semibold" : "medium"}
              className={`text-small ${
                selected ? "text-text-primary" : "text-text-secondary"
              }`}
            >
              {label}
            </AppText>
          </SafePressable>
        );
      })}
    </View>
  );
}

/**
 * Displays backend-grouped vouch history and full-history totals.
 *
 * Presents illustrated summary cards consistent with Merchant Business
 * Overview while preserving pagination, sorting, refresh, and vouch management.
 */
export default function VouchHistoryScreen() {
  const [ordering, setOrdering] = useState<VouchHistoryOrdering>("newest");
  const [selectedBusiness, setSelectedBusiness] =
    useState<VouchHistoryBusiness | null>(null);
  const [pendingBusinessId, setPendingBusinessId] = useState<number | null>(
    null,
  );

  const requestPendingRef = useRef(false);
  const nextPagePendingRef = useRef(false);
  const listRef = useRef<FlatList<VouchHistoryBusiness>>(null);

  // Pin the mutation target until settlement, even if selection changes.
  const { vouch } = useBusinessVouch({
    businessId: pendingBusinessId ?? selectedBusiness?.business_id ?? 0,
  });

  const history = useVouchHistory(ordering);
  const insets = useSafeAreaInsets();

  useQueryErrorNotification({
    error: history.error,
    toastId: "vouch-history-error",
    title: "Unable to load vouch history",
    fallbackMessage: "Please try again.",
  });

  const changeOrdering = useCallback(
    (value: VouchHistoryOrdering) => {
      if (value === ordering) return;

      setOrdering(value);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    },
    [ordering],
  );

  async function toggleSpecialty(tag: ExploreBusinessSpecialtyTag) {
    if (requestPendingRef.current || !selectedBusiness) return;

    requestPendingRef.current = true;
    setPendingBusinessId(selectedBusiness.business_id);

    try {
      await vouch({
        tagId: tag.id,
        isVouched: tag.is_vouched,
      });

      Toast.show({
        type: "info",
        text1: tag.is_vouched ? "Vouch removed" : `Vouched for ${tag.name}`,
        visibilityTime: 1500,
      });
    } catch (error) {
      const response = error as ApiResponse<unknown>;

      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to update vouch",
          text2: response.message || "Please try again.",
        });
      }
    } finally {
      requestPendingRef.current = false;
      setPendingBusinessId(null);
    }
  }

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

  // setSelectedBusiness and router are stable, so rows keep a stable renderer.
  const renderItem = useCallback(
    ({ item }: { item: VouchHistoryBusiness }) => (
      <VouchHistoryItem
        business={item}
        onManage={() => setSelectedBusiness(item)}
        onOpenBusiness={() =>
          router.push({
            pathname: "/(explorer)/business/[businessId]",
            params: { businessId: String(item.business_id) },
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
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          title: "Vouch History",
        }}
      />

      {/* Summary totals and sorting controls */}
      <View className="px-4 pb-4 pt-4">
        {history.summary ? (
          <View className="flex-row gap-3">
            <SummaryCard
              Icon={BusinessesVouchedIllustration}
              label="Businesses vouched"
              value={history.summary.total_businesses}
              testID="history-business-total"
            />
            <SummaryCard
              Icon={SpecialtyVouchesIllustration}
              label="Specialty vouches"
              value={history.summary.total_specialty_vouches}
              testID="history-specialty-total"
            />
          </View>
        ) : history.isLoading ? (
          <Skeleton className="h-12 w-4/5 rounded-md" />
        ) : null}

        <SortControl ordering={ordering} onChange={changeOrdering} />
      </View>

      {/* Business history list and request recovery */}
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
                title="Unable to load vouch history"
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
                style={{ width: 50, height: 50 }}
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
          isMutationPending={pendingBusinessId !== null}
          onToggleSpecialty={toggleSpecialty}
          onDismiss={() => setSelectedBusiness(null)}
        />
      )}
    </SafeAreaView>
  );
}
