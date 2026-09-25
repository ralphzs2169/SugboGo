import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { useReviewLike } from "@/features/explore/hooks/useReviewLike";
import ActionBottomSheet from "@/shared/components/bottom-sheets/ActionBottomSheet";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import { useDeleteReviewReply } from "../../hooks/review-reply/useReviewReplies";
import type { BusinessReview } from "@/features/explore/types/review.types";
import MerchantReviewResponse from "@/features/explore/components/business-profile/reviews/MerchantReviewResponse";
import ReviewContent from "@/features/explore/components/business-profile/reviews/ReviewContent";

type Props = {
  businessId: number;
  review: BusinessReview;
  onReply: (review: BusinessReview) => void;
};

/**
 * Presents a customer review in a merchant-management context.
 *
 * Shared review content is delegated to ReviewContent, while merchant-specific
 * reply controls, response content, dispute navigation, and reply management remain
 * in this card.
 */
export default function MerchantReviewCard({
  businessId,
  review,
  onReply,
}: Props) {
  const { mutateAsync: deleteReply, isPending: isDeletePending } =
    useDeleteReviewReply(businessId);

  const { mutateAsync: like, isPending: isLikePending } =
    useReviewLike(businessId);

  const actionSheetRef = useRef<BottomSheetModal | null>(null);
  const [isDeleteVisible, setIsDeleteVisible] = useState(false);

  const handleDeleteReply = async () => {
    if (!review.reply) {
      return;
    }

    try {
      await deleteReply({
        replyId: review.reply.id,
      });

      Toast.show({
        type: "success",
        text1: "Reply deleted",
      });

      setIsDeleteVisible(false);
    } catch (error) {
      const response = error as unknown as ApiResponse<unknown>;

      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to delete reply",
          text2: response.message || "Please try again.",
        });
      }
    }
  };

  const toggleLike = async () => {
    try {
      await like({
        reviewId: review.id,
        isLiked: review.is_liked,
        isOwner: true,
      });
    } catch (error) {
      const response = error as unknown as ApiResponse<unknown>;

      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to update like",
          text2: response.message || "Please try again.",
        });
      }
    }
  };

  return (
    <View className="rounded-card border border-border-primary bg-surface p-4">
      {/* Shared review content */}
      <ReviewContent
        review={review}
        onReply={() => onReply(review)}
        onLike={toggleLike}
        isLikePending={isLikePending}
        perspective="merchant"
        onActions={() => presentBottomSheet(actionSheetRef)}
      />

      {/* Active dispute status */}
      {review.active_dispute_id && (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(merchant)/review-disputes/[disputeId]",
              params: {
                disputeId: String(review.active_dispute_id),
              },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="View pending review dispute"
          className="mt-4 cursor-pointer flex-row items-center rounded-xl border border-info bg-info-muted px-3 py-2.5 active:opacity-70"
        >
          {/* Status icon */}
          <View className="h-8 w-8 items-center justify-center rounded-full bg-info">
            <MaterialCommunityIcons
              name="clock-outline"
              size={17}
              color={theme.extends.colors.text.info}
            />
          </View>

          {/* Status details */}
          <View className="ml-2.5 min-w-0 flex-1">
            <Text className="text-xs font-semibold text-info-text">
              Dispute pending
            </Text>

            <Text className="mt-0.5 text-[11px] text-text-secondary">
              Awaiting administrator review
            </Text>
          </View>

          {/* Navigation */}
          <MaterialCommunityIcons
            name="chevron-right"
            size={19}
            color={theme.extends.colors.text.tertiary}
          />
        </Pressable>
      )}

      {review.reply && (
        <MerchantReviewResponse reply={review.reply} perspective="merchant" />
      )}

      {/* Review and reply actions */}
      <ActionBottomSheet
        sheetRef={actionSheetRef}
        options={[
          ...(review.reply
            ? [
                {
                  label: "Edit reply",
                  value: "edit",
                },
                {
                  label: "Delete reply",
                  value: "delete",
                  color: theme.extends.colors.error,
                },
              ]
            : []),
          {
            label: review.active_dispute_id ? "View dispute" : "Dispute review",
            value: "dispute",
          },
        ]}
        onSelect={(value) => {
          if (value === "dispute") {
            if (review.active_dispute_id) {
              router.push({
                pathname: "/(merchant)/review-disputes/[disputeId]",
                params: {
                  disputeId: String(review.active_dispute_id),
                },
              });
              return;
            }

            router.push({
              pathname: "/(merchant)/review-disputes/create/[reviewId]",
              params: { reviewId: String(review.id) },
            });
          }

          if (value === "edit") {
            onReply(review);
          }

          if (value === "delete") {
            setIsDeleteVisible(true);
          }
        }}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        visible={isDeleteVisible}
        title="Delete reply?"
        message="Your response and its uploaded photos will be permanently deleted."
        confirmText="Delete"
        destructive
        isLoading={isDeletePending}
        loadingText="Deleting reply..."
        onCancel={() => setIsDeleteVisible(false)}
        onConfirm={handleDeleteReply}
      />
    </View>
  );
}
