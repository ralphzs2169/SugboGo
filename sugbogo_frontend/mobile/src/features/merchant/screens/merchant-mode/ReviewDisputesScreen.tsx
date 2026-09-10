import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import Avatar from "@/shared/components/Avatar";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { formatDate } from "@/shared/utils/date.utils";

import ReviewDisputeScreenSkeleton from "../../components/review-disputes/ReviewDisputeScreenSkeleton";
import ReviewDisputeStatusBadge from "../../components/review-disputes/ReviewDisputeStatusBadge";
import { REVIEW_DISPUTE_REASON_LABELS } from "../../constants/reviewDispute.constants";
import { useReviewDisputes } from "../../hooks/review-disputes/useReviewDisputes";
import type { ReviewDispute } from "../../types/review-disputes/reviewDispute.types";

const MASCOT_EMPTY_DISPUTES = require("@/shared/assets/mascot/mascot-empty-disputes.webp");

const MASCOT_ALL_CAUGHT_UP = require("@/shared/assets/mascot/mascot-all-caught-up.webp");

const MASCOT_NO_HISTORY = require("@/shared/assets/mascot/mascot-no-history.webp");

type DisputeFilter = "all" | "pending" | "resolved";

const FILTER_OPTIONS: {
  value: DisputeFilter;
  label: string;
}[] = [
  {
    value: "all",
    label: "All",
  },
  {
    value: "pending",
    label: "Pending",
  },
  {
    value: "resolved",
    label: "Resolved",
  },
];

/**
 * Displays the merchant's submitted review disputes and their current status.
 *
 * Supports status filtering, pull-to-refresh, dispute navigation, and
 * tab-bar-aware spacing. Uses consistent SugboGo mascot states for empty,
 * all-caught-up, and no-history dispute experiences.
 */
export default function ReviewDisputesScreen() {
  const [filter, setFilter] = useState<DisputeFilter>("all");

  const tabBarSpacing = useTabBarSpacing(0);

  const { disputes, isLoading, isRefetching, error, refetch } =
    useReviewDisputes();

  const filteredDisputes = useMemo(() => {
    if (filter === "pending") {
      return disputes.filter((dispute) => dispute.status === "pending");
    }

    if (filter === "resolved") {
      return disputes.filter((dispute) =>
        ["upheld", "dismissed", "withdrawn"].includes(dispute.status),
      );
    }

    return disputes;
  }, [disputes, filter]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const response = error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load disputes",
        text2: response.message || "Please try again.",
      });
    }
  }, [error]);

  const openDispute = (dispute: ReviewDispute) => {
    router.push({
      pathname: "/(merchant)/review-disputes/[disputeId]",
      params: {
        disputeId: String(dispute.id),
      },
    });
  };

  if (isLoading) {
    return <ReviewDisputeScreenSkeleton />;
  }

  if (error && disputes.length === 0) {
    return (
      <View className="flex-1 bg-background">
        {/* Dispute load error */}
        <ErrorState
          size="small"
          icon="file-alert-outline"
          title="Unable to load disputes"
          description="We couldn't load your review disputes right now."
          primaryActionTitle="Retry"
          secondaryActionTitle="Go back"
          onPrimaryAction={() => void refetch()}
          onSecondaryAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Dispute collection */}
      <FlatList
        data={filteredDisputes}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pt-4"
        contentContainerStyle={{
          paddingBottom: tabBarSpacing,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={theme.extends.colors.brand}
          />
        }
        ListHeaderComponent={
          <View className="mb-4">
            {/* Screen guidance */}
            <AppText className="text-sm leading-5 text-text-secondary">
              Track disputes you've submitted for administrator review.
            </AppText>

            {/* Status filters */}
            <View className="mt-4 flex-row gap-2">
              {FILTER_OPTIONS.map((option) => {
                const isSelected = filter === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setFilter(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: isSelected,
                    }}
                    className={`cursor-pointer rounded-full border px-4 py-2.5 active:opacity-75 ${
                      isSelected
                        ? "border-brand bg-brand"
                        : "border-border-primary bg-surface"
                    }`}
                  >
                    <AppText
                      weight="semibold"
                      className={`text-sm ${
                        isSelected ? "text-white" : "text-text-secondary"
                      }`}
                    >
                      {option.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openDispute(item)}
            accessibilityRole="button"
            accessibilityLabel={`Open dispute attempt ${item.attempt_number} for ${item.review.author.first_name} ${item.review.author.last_name}'s review`}
            className="cursor-pointer rounded-card border border-border-primary bg-surface p-4 active:opacity-75"
          >
            {/* Dispute identity */}
            <View className="flex-row items-start gap-3">
              <Avatar imageUrl={item.review.author.avatar_url} size={34} />

              <View className="min-w-0 flex-1">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <AppText
                      weight="bold"
                      className="text-base text-text-primary"
                      numberOfLines={1}
                    >
                      Dispute attempt {item.attempt_number}
                    </AppText>

                    <AppText
                      weight="medium"
                      className="mt-1 text-sm text-text-primary"
                      numberOfLines={2}
                    >
                      {REVIEW_DISPUTE_REASON_LABELS[item.reason]}
                    </AppText>

                    <AppText
                      className="mt-1 text-xs text-text-secondary"
                      numberOfLines={1}
                    >
                      {item.review.author.first_name}{" "}
                      {item.review.author.last_name}
                    </AppText>
                  </View>

                  <ReviewDisputeStatusBadge status={item.status} />
                </View>
              </View>
            </View>

            {/* Review preview */}
            <View className="mt-4 rounded-xl bg-background px-3.5 py-3">
              <MaterialCommunityIcons
                name="format-quote-open"
                size={17}
                color={theme.extends.colors.text.tertiary}
              />

              <AppText
                className="mt-1 text-sm leading-5 text-text-secondary"
                numberOfLines={2}
              >
                {item.review.text}
              </AppText>
            </View>

            {/* Dispute metadata */}
            <View className="mt-4 flex-row items-center justify-between border-t border-border-primary pt-3">
              <View className="min-w-0 flex-1 flex-row items-center">
                <MaterialCommunityIcons
                  name="calendar-blank-outline"
                  size={14}
                  color={theme.extends.colors.text.tertiary}
                />

                <AppText className="ml-1.5 text-xs text-text-secondary">
                  Submitted {formatDate(item.created_at)}
                </AppText>
              </View>

              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={theme.extends.colors.text.tertiary}
              />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <>
            {/* Empty dispute collection */}
            {filter === "all" && (
              <View className="items-center px-6 py-10">
                <Image
                  source={MASCOT_EMPTY_DISPUTES}
                  style={{ width: 120, height: 120 }}
                  contentFit="contain"
                />

                <AppText
                  weight="bold"
                  className="mt-2 text-center text-base text-text-primary"
                >
                  No review disputes
                </AppText>

                <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
                  Disputes you submit from customer reviews will appear here.
                </AppText>
              </View>
            )}

            {/* Pending disputes all-caught-up state */}
            {filter === "pending" && (
              <View className="items-center px-6 py-10">
                <Image
                  source={MASCOT_ALL_CAUGHT_UP}
                  style={{ width: 120, height: 120 }}
                  contentFit="contain"
                />

                <AppText
                  weight="bold"
                  className="mt-2 text-center text-base text-text-primary"
                >
                  All caught up
                </AppText>

                <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
                  You don't have any disputes waiting for review.
                </AppText>
              </View>
            )}

            {/* Resolved disputes no-history state */}
            {filter === "resolved" && (
              <View className="items-center px-6 py-10">
                <Image
                  source={MASCOT_NO_HISTORY}
                  style={{ width: 120, height: 120 }}
                  contentFit="contain"
                />

                <AppText
                  weight="bold"
                  className="mt-2 text-center text-base text-text-primary"
                >
                  No resolved disputes yet
                </AppText>

                <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
                  Resolved disputes will appear here once a decision has been
                  made.
                </AppText>
              </View>
            )}
          </>
        }
      />
    </View>
  );
}
