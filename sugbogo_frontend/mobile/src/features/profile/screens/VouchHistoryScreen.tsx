import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import LottieView from "lottie-react-native";
import { useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
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

function VouchSeparator() {
  return <View className="mx-4 h-px bg-border-primary" />;
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

  // Pin the mutation target until settlement, even if selection changes.
  const { vouch } = useBusinessVouch({
    businessId: pendingBusinessId ?? selectedBusiness?.business_id ?? 0,
  });

  const history = useVouchHistory(ordering);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<VouchHistoryBusiness>>(null);
  const nextPagePendingRef = useRef(false);

  useQueryErrorNotification({
    error: history.error,
    toastId: "vouch-history-error",
    title: "Unable to load vouch history",
    fallbackMessage: "Please try again.",
  });

  function changeOrdering(value: VouchHistoryOrdering) {
    setOrdering(value);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

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

  const initialError = Boolean(history.error) && !history.hasData;

  const refreshError =
    Boolean(history.error) && history.hasData && !history.isFetchNextPageError;

  const showEnd =
    history.businesses.length >= 5 &&
    !history.hasNextPage &&
    !history.isFetching &&
    !history.error;

  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-background">
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
          <View className="flex-row gap-2">
            {[
              {
                key: "businesses",
                Icon: BusinessesVouchedIllustration,
                label: "Businesses vouched",
                value: String(history.summary.total_businesses),
                testID: "history-business-total",
              },
              {
                key: "specialties",
                Icon: SpecialtyVouchesIllustration,
                label: "Specialty vouches",
                value: String(history.summary.total_specialty_vouches),
                testID: "history-specialty-total",
              },
            ].map((item) => (
              <View
                key={item.key}
                className="min-w-0 flex-1 rounded-xl border border-border-primary/70 bg-surface px-3 py-3"
              >
                {/* Illustrated metric icon */}
                <View className="h-10 w-10 items-center justify-center">
                  <item.Icon width={40} height={40} />
                </View>

                {/* Metric label */}
                <AppText
                  className="mt-3 text-xs text-text-secondary"
                  numberOfLines={2}
                >
                  {item.label}
                </AppText>

                {/* Metric value */}
                <AppText
                  weight="semibold"
                  className="mt-0.5 text-sm text-text-primary"
                  testID={item.testID}
                >
                  {item.value}
                </AppText>
              </View>
            ))}
          </View>
        ) : history.isLoading ? (
          <Skeleton className="h-12 w-4/5 rounded-md" />
        ) : null}

        {/* Compact segmented sorting control */}
        <View className="mt-4 flex-row rounded-full bg-surface-muted p-xs">
          {(["newest", "oldest"] as const).map((value) => {
            const selected = ordering === value;
            const label = value === "newest" ? "Newest" : "Oldest";

            return (
              <SafePressable
                key={value}
                onPress={() => changeOrdering(value)}
                accessibilityLabel={`Sort history by ${label}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                hitSlop={{ top: 4, bottom: 4 }}
                className={`min-h-[40px] min-w-0 flex-1 cursor-pointer flex-row items-center justify-center gap-xs rounded-full px-sm py-sm active:opacity-75 ${
                  selected ? "bg-brand" : "bg-surface-muted"
                }`}
              >
                {selected && (
                  <MaterialCommunityIcons
                    name="check"
                    size={14}
                    color={theme.extends.colors.surface}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                )}

                <AppText
                  weight={selected ? "semibold" : "medium"}
                  className={`text-small ${
                    selected ? "text-white" : "text-text-primary"
                  }`}
                >
                  {label}
                </AppText>
              </SafePressable>
            );
          })}
        </View>
      </View>

      {/* Business history list and request recovery */}
      <FlatList
        ref={listRef}
        testID="vouch-history-list"
        data={history.businesses}
        keyExtractor={(business) => String(business.id)}
        ItemSeparatorComponent={VouchSeparator}
        renderItem={({ item }) => (
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
        )}
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
          isMutationPending={pendingBusinessId !== null}
          onToggleSpecialty={toggleSpecialty}
          onDismiss={() => setSelectedBusiness(null)}
        />
      )}
    </SafeAreaView>
  );
}
