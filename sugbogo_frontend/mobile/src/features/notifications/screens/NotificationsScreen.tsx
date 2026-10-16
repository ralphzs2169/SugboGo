import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import { useRef, useState } from "react";
import Toast from "react-native-toast-message";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

import { theme } from "@/constants/theme";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import AppText from "@/shared/components/AppText";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import NotificationEmptyState from "../components/NotificationEmptyState";
import NotificationFilters from "../components/NotificationFilters";
import NotificationListSkeleton from "../components/NotificationListSkeleton";
import NotificationRow from "../components/NotificationRow";
import { useNotificationMutations } from "../hooks/useNotificationMutations";
import { useNotificationNavigation } from "../hooks/useNotificationNavigation";
import { useNotificationRefreshLifecycle } from "../hooks/useNotificationRefreshLifecycle";
import {
  useNotifications,
  useNotificationUnreadCount,
} from "../hooks/useNotifications";
import type { NotificationFilter } from "../types/notification.types";
import { resolveNotificationDestination } from "../utils/notificationDestination";

function showMutationError(error: unknown, title: string) {
  const response = error as Partial<ApiResponse<unknown>> | null;

  if (
    response?.success === false &&
    handleSystemError(response as ApiResponse<unknown>)
  ) {
    return;
  }

  Toast.show({
    type: "error",
    text1: title,
    text2:
      response?.success === false && response.message
        ? response.message
        : "Please try again.",
  });
}

/**
 * Displays the authenticated account's reusable notification inbox.
 *
 * Keeps server-side filters and pagination independent while synchronizing
 * optimistic read actions, unread totals, focus refresh, and app resumes.
 */
export default function NotificationsScreen() {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const endReachedHandled = useRef(false);
  const insets = useSafeAreaInsets();
  const bottomSpacing = insets.bottom + 20;

  const inbox = useNotifications(filter);
  const unread = useNotificationUnreadCount();
  const mutations = useNotificationMutations();
  const navigation = useNotificationNavigation({
    markRead: mutations.markRead,
  });
  useNotificationRefreshLifecycle();

  const loadedUnreadCount = inbox.notifications.filter(
    (notification) => !notification.is_read,
  ).length;
  const fallbackUnreadCount =
    filter === "unread" && inbox.hasData ? inbox.totalItems : loadedUnreadCount;
  const effectiveUnreadCount = unread.unreadCount ?? fallbackUnreadCount;
  const isMutating =
    mutations.isMarkingOneRead ||
    mutations.isMarkingAllRead ||
    navigation.isHandlingNotification;
  const canMarkAllRead = effectiveUnreadCount > 0 && !isMutating;
  const initialLoadFailed = Boolean(inbox.error && !inbox.hasData);
  const refreshFailed = Boolean(
    inbox.error && inbox.hasData && !inbox.isFetchNextPageError,
  );

  useQueryErrorNotification({
    error: inbox.error,
    toastId: "notifications-list-error",
    title: "Unable to load notifications",
    fallbackMessage: "Please try again.",
  });

  useQueryErrorNotification({
    error: unread.error,
    toastId: "notification-count-error",
    title: "Unread count unavailable",
    fallbackMessage: "Your notifications are still available below.",
  });

  async function refreshInbox() {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    try {
      await Promise.all([inbox.refetch(), unread.refetch()]);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function markAllRead() {
    if (!canMarkAllRead) {
      return;
    }

    try {
      await mutations.markAllRead();
    } catch (error) {
      showMutationError(error, "Couldn't mark all as read");
    }
  }

  function loadNextPage() {
    if (
      endReachedHandled.current ||
      !inbox.hasNextPage ||
      inbox.isFetchingNextPage
    ) {
      return;
    }

    endReachedHandled.current = true;
    void inbox.fetchNextPage();
  }

  const shouldShowEndMessage =
    !inbox.hasNextPage &&
    !inbox.isFetchingNextPage &&
    inbox.notifications.length >= 8;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-surface"
    >
      {/* Screen header */}
      <View className="flex-row items-center justify-between gap-3 px-5 pb-2 pt-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="-ml-2 h-11 w-11 cursor-pointer items-center justify-center rounded-full active:bg-background"
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={26}
            color={theme.extends.colors.text.primary}
          />
        </Pressable>

        <AppText
          weight="bold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          className="flex-1 text-2xl text-text-primary"
        >
          Notifications
        </AppText>

        <Pressable
          onPress={() => void markAllRead()}
          disabled={!canMarkAllRead}
          accessibilityRole="button"
          accessibilityLabel="Mark all notifications as read"
          accessibilityState={{
            disabled: !canMarkAllRead,
            busy: mutations.isMarkingAllRead,
          }}
          className="min-h-11 cursor-pointer flex-row items-center justify-center px-1 active:opacity-65"
        >
          {mutations.isMarkingAllRead ? (
            <>
              <ActivityIndicator
                size="small"
                color={theme.extends.colors.brand}
              />
              <AppText weight="semibold" className="ml-2 text-sm text-brand">
                Marking…
              </AppText>
            </>
          ) : (
            <AppText
              weight="semibold"
              className={`max-w-36 text-right text-sm ${
                canMarkAllRead ? "text-brand" : "text-text-tertiary"
              }`}
            >
              Mark all as read
            </AppText>
          )}
        </Pressable>
      </View>

      {/* Server-backed inbox filters */}
      <NotificationFilters
        value={filter}
        unreadCount={unread.unreadCount}
        onChange={setFilter}
      />

      <View className="h-px bg-border-primary" />

      {/* Notification collection */}
      {inbox.isInitialLoading ? (
        <NotificationListSkeleton />
      ) : initialLoadFailed ? (
        <ErrorState
          title="Unable to load notifications"
          description="We couldn't load your notification inbox right now."
          primaryActionTitle="Retry"
          onPrimaryAction={() => void inbox.refetch()}
        />
      ) : (
        <FlatList
          testID="notification-list"
          data={inbox.notifications}
          keyExtractor={(notification) => String(notification.id)}
          renderItem={({ item }) => {
            const resolution = resolveNotificationDestination(item);

            return (
              <NotificationRow
                notification={item}
                isPending={navigation.pendingNotificationId === item.id}
                disabled={isMutating}
                isNavigable={resolution.kind === "destination"}
                isUnavailable={resolution.kind === "unavailable"}
                destinationLabel={
                  resolution.kind === "destination"
                    ? resolution.destination.label
                    : undefined
                }
                onPress={(notification) =>
                  void navigation.handleNotificationPress(notification)
                }
              />
            );
          }}
          ItemSeparatorComponent={() => (
            <View className="ml-[72px] mr-5 h-px bg-border-primary" />
          )}
          ListHeaderComponent={
            refreshFailed ? (
              <View className="py-3">
                {/* Recoverable cached-list error */}
                <ErrorState
                  size="section"
                  title="Unable to refresh notifications"
                  description="Showing your last available notifications."
                  primaryActionTitle="Retry"
                  onPrimaryAction={() => void inbox.refetch()}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={<NotificationEmptyState filter={filter} />}
          ListFooterComponent={
            inbox.isFetchingNextPage ? (
              <View
                className="items-center py-5"
                testID="notification-page-loader"
              >
                <LottieView
                  source={loadingAnimation}
                  autoPlay
                  loop
                  style={{ width: 50, height: 50 }}
                />
              </View>
            ) : inbox.isFetchNextPageError ? (
              <View className="py-3">
                <ErrorState
                  size="section"
                  title="Unable to load more notifications"
                  description="Your loaded notifications are still available."
                  primaryActionTitle="Retry"
                  onPrimaryAction={() => void inbox.fetchNextPage()}
                />
              </View>
            ) : shouldShowEndMessage ? (
              <EndOfListMessage description="You've reached the end of your notifications." />
            ) : null
          }
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: bottomSpacing,
          }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadNextPage}
          onEndReachedThreshold={0.35}
          onMomentumScrollBegin={() => {
            endReachedHandled.current = false;
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing && !inbox.isFetchingNextPage}
              onRefresh={() => void refreshInbox()}
              tintColor={theme.extends.colors.brand}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
