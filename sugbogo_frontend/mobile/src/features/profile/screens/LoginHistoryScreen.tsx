import { FlatList, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";

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

const methodLabels: Record<LoginEvent["method"], string> = {
  password: "Password",
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
function LoginHistoryRow({ event }: { event: LoginEvent }) {
  return (
    <View className="border-b border-border-primary py-4">
      <AppText
        weight="semibold"
        className={
          event.outcome === "failed"
            ? "text-base text-text-error"
            : "text-base text-text-primary"
        }
      >
        {outcomeLabels[event.outcome]}
      </AppText>
      <AppText className="mt-1 text-sm text-text-primary">
        {methodLabels[event.method]} · {event.platform} · {event.client}
      </AppText>
      <AppText className="mt-1 text-sm text-text-secondary">
        {new Date(event.created_at).toLocaleString()}
      </AppText>
      <AppText className="mt-1 text-sm text-text-secondary">
        Network address: {event.ip_address ?? "Unavailable"}
      </AppText>
    </View>
  );
}

/** Shows the account's recent login activity with refresh and paginated recovery. */
export default function LoginHistoryScreen() {
  const history = useLoginHistory();
  const hasData = history.data !== undefined;
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
        renderItem={({ item }) => <LoginHistoryRow event={item} />}
        contentContainerClassName="grow px-4 pb-6"
        ListHeaderComponent={
          <View className="pt-4 pb-2">
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
          ) : history.events.length > 0 && !history.hasNextPage ? (
            <EndOfListMessage description="You've reached the end of your recent sign-in activity." />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
