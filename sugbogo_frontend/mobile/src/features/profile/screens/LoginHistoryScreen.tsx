import { FlatList, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { memo, useCallback } from "react";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Skeleton from "@/shared/components/Skeleton";
import ErrorState from "@/shared/components/ErrorState";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { isStaleAuthSessionError } from "@/shared/api/authSessionGeneration.service";
import useLoginHistory from "../hooks/useLoginHistory";
import type { LoginEvent } from "../types/loginHistory.types";
import {
  activityDayKey,
  activityDayLabel,
} from "../utils/activityTimeline.utils";

const END_MESSAGE_MIN_ITEMS = 5;

const methodLabels: Record<LoginEvent["method"], string> = {
  password: "Email & password",
  admin: "Admin password",
  google: "Google",
  facebook: "Facebook",
};
const outcomeLabels: Record<LoginEvent["outcome"], string> = {
  success: "Successful sign-in",
  failed: "Unsuccessful sign-in",
  unavailable: "Sign-in service unavailable",
};

/** Displays a recent sign-in outcome with approximate client details. */
const LoginHistoryRow = memo(function LoginHistoryRow({
  event,
}: {
  event: LoginEvent;
}) {
  const outcomeStyle =
    event.outcome === "success"
      ? "bg-green-100 text-green-700"
      : event.outcome === "failed"
        ? "bg-error/10 text-text-error"
        : "bg-info text-text-info";

  return (
    <View className="flex-row gap-3 py-4">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-muted">
        <MaterialCommunityIcons
          name={
            event.outcome === "failed"
              ? "shield-alert-outline"
              : "login-variant"
          }
          size={19}
          color={
            event.outcome === "failed"
              ? theme.extends.colors.error
              : theme.extends.colors.text.secondary
          }
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
      <View className="min-w-0 flex-1 gap-2">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <AppText weight="semibold" className="text-sm text-text-primary">
            {methodLabels[event.method]}
          </AppText>
          <AppText className="text-xs text-text-secondary">
            {new Date(event.created_at).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })}
          </AppText>
        </View>
        <View className="self-start">
          <AppText
            weight="medium"
            className={`rounded-full px-2.5 py-1 text-xs ${outcomeStyle}`}
          >
            {outcomeLabels[event.outcome]}
          </AppText>
        </View>
        <View>
          <AppText className="text-sm leading-5 text-text-secondary">
            {event.platform} · {event.client}
          </AppText>
          <AppText className="mt-1 text-xs leading-4 text-text-tertiary">
            Network address: {event.ip_address ?? "Unavailable"}
          </AppText>
        </View>
      </View>
    </View>
  );
});

/** Shows the account's recent login activity with refresh and paginated recovery. */
export default function LoginHistoryScreen() {
  const history = useLoginHistory();
  const hasData = history.data !== undefined;
  const renderEvent = useCallback(
    ({ item, index }: { item: LoginEvent; index: number }) => {
      const previous = history.events[index - 1];
      const startsDay =
        !previous ||
        activityDayKey(previous.created_at) !== activityDayKey(item.created_at);
      return (
        <View>
          {startsDay ? (
            <AppText
              accessibilityRole="header"
              weight="semibold"
              className="border-b border-border-primary pb-2 pt-4 text-xs text-text-secondary"
            >
              {activityDayLabel(item.created_at)}
            </AppText>
          ) : (
            <View className="ml-12 h-px bg-border-primary/60" />
          )}
          <LoginHistoryRow event={item} />
        </View>
      );
    },
    [history.events],
  );
  useQueryErrorNotification({
    error: isStaleAuthSessionError(history.error) ? null : history.error,
    toastId: "login-history",
    title: "Unable to load login history",
    fallbackMessage: "Please try again.",
  });

  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      className="flex-1 bg-surface"
    >
      {/* Retained activity and recovery states */}
      <FlatList
        data={history.events}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderEvent}
        contentContainerClassName="grow px-4 pb-6"
        ListHeaderComponent={
          <View className="pt-4 pb-2">
            <AppText
              weight="semibold"
              className="mb-1 text-base text-text-primary"
            >
              Recent sign-ins
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              Recent sign-in activity from the last 90 days. Device details are
              approximate; network addresses may be shared.
            </AppText>
            {hasData && history.isError && !history.isFetchNextPageError && (
              <ErrorState
                size="section"
                title="Unable to refresh activity"
                description="Your previously loaded activity is still shown."
                primaryActionTitle="Retry"
                onPrimaryAction={() => void history.refetch()}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          history.isPending ? (
            <View
              accessibilityLabel="Loading login history"
              className="gap-4 py-4"
            >
              {[0, 1, 2].map((id) => (
                <Skeleton key={id} className="h-24 rounded-lg" />
              ))}
            </View>
          ) : history.isError && !hasData ? (
            <ErrorState
              title="Unable to load login history"
              description="We couldn't retrieve your activity. Please try again."
              primaryActionTitle="Retry"
              onPrimaryAction={() => void history.refetch()}
            />
          ) : (
            <View className="items-center px-4 py-12">
              <AppText
                weight="semibold"
                className="text-base text-text-primary"
              >
                No recent sign-in activity
              </AppText>
              <AppText className="mt-2 text-center text-sm text-text-secondary">
                New sign-in attempts will appear here. Earlier activity is not
                backfilled.
              </AppText>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching && !history.isFetchingNextPage}
            onRefresh={() => void history.refetch()}
            tintColor={theme.extends.colors.brand}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (
            history.hasNextPage &&
            !history.isFetching &&
            !history.isFetchNextPageError
          )
            void history.fetchNextPage();
        }}
        ListFooterComponent={
          history.isFetchingNextPage ? (
            <View className="items-center py-4">
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
              title="Unable to load more activity"
              description="Your loaded activity is still available."
              primaryActionTitle="Retry"
              onPrimaryAction={() => void history.fetchNextPage()}
            />
          ) : history.events.length >= END_MESSAGE_MIN_ITEMS &&
            !history.hasNextPage &&
            !history.isFetching &&
            !history.isError ? (
            <EndOfListMessage description="You've reached the end of your recent sign-in activity." />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
