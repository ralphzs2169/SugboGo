import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
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
import MerchantReviewResponse from "@/features/explore/components/business-profile/review-section/MerchantReviewResponse";
import ReviewContent from "@/features/explore/components/business-profile/review-section/ReviewContent";

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

      {/* Merchant response */}
      {review.reply ? (
        <MerchantReviewResponse reply={review.reply} perspective="merchant" />
      ) : (
        <View className="mt-4 flex-row items-center rounded-lg bg-brand/10 px-3 py-2.5">
          <MaterialCommunityIcons
            name="reply-outline"
            size={16}
            color={theme.extends.colors.brand}
          />

          <Text className="ml-2 flex-1 text-xs font-medium text-text-primary">
            This review needs your response.
          </Text>
        </View>
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
