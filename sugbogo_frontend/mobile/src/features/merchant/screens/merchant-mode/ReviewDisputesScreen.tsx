import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import ErrorState from "@/shared/components/ErrorState";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { formatDate } from "@/shared/utils/date.utils";

import ReviewDisputeStatusBadge from "../../components/review-disputes/ReviewDisputeStatusBadge";
import { REVIEW_DISPUTE_REASON_LABELS } from "../../constants/reviewDispute.constants";
import { useReviewDisputes } from "../../hooks/review-disputes/useReviewDisputes";
import type { ReviewDispute } from "../../types/review-disputes/reviewDispute.types";

/** Lists the merchant's dispute cases separately from review reply management. */
export default function ReviewDisputesScreen() {
  const { disputes, isLoading, isRefetching, error, refetch } =
    useReviewDisputes();

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
      params: { disputeId: String(dispute.id) },
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={theme.extends.colors.brand} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          size="small"
          icon="file-alert-outline"
          title="Unable to load disputes"
          description="We couldn't load your review disputes right now."
          primaryActionTitle="Retry"
          onPrimaryAction={() => void refetch()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Dispute collection */}
      <FlatList
        data={disputes}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="px-4 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={theme.extends.colors.brand}
          />
        }
        ListHeaderComponent={
          <Text className="mb-4 text-sm leading-5 text-text-secondary">
            Track review policy concerns submitted for administrator review.
          </Text>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openDispute(item)}
            accessibilityRole="button"
            accessibilityLabel={`Open dispute for ${item.review.author.first_name} ${item.review.author.last_name}'s review`}
            className="cursor-pointer rounded-card border border-border-primary bg-surface p-4 active:opacity-75"
          >
            {/* Case summary */}
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text
                  className="text-base font-bold text-text-primary"
                  numberOfLines={1}
                >
                  {item.review.author.first_name} {item.review.author.last_name}
                </Text>
                <Text className="mt-1 text-sm text-text-secondary">
                  {REVIEW_DISPUTE_REASON_LABELS[item.reason]}
                </Text>
              </View>

              <ReviewDisputeStatusBadge status={item.status} />
            </View>

            <Text
              className="mt-3 text-sm leading-5 text-text-secondary"
              numberOfLines={2}
            >
              {item.review.text}
            </Text>

            {/* Case navigation */}
            <View className="mt-4 flex-row items-center justify-between border-t border-border-primary pt-3">
              <Text className="text-xs text-text-secondary">
                Submitted {formatDate(item.created_at)}
              </Text>

              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={theme.extends.colors.text.tertiary}
              />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center rounded-card border border-border-primary bg-surface px-6 py-10">
            {/* Empty state */}
            <MaterialCommunityIcons
              name="file-document-check-outline"
              size={42}
              color={theme.extends.colors.text.tertiary}
            />
            <Text className="mt-3 text-base font-bold text-text-primary">
              No review disputes
            </Text>
            <Text className="mt-1 text-center text-sm leading-5 text-text-secondary">
              Disputes you submit from customer reviews will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}
