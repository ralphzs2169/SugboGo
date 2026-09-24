import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import Toast from "react-native-toast-message";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import ActionBottomSheet from "@/shared/components/bottom-sheets/ActionBottomSheet";
import { theme } from "@/constants/theme";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import {
  useDeleteReview,
  useReportReview,
} from "../../../hooks/useBusinessReviews";
import { useReviewLike } from "../../../hooks/useReviewLike";
import type { BusinessReview } from "../../../types/review.types";
import MerchantReviewResponse from "./MerchantReviewResponse";
import ReviewContent from "./ReviewContent";

type Props = {
  businessId: number;
  review: BusinessReview;
  onEdit?: (review: BusinessReview) => void;
};

/**
 * Presents a customer review in the explorer business profile.
 *
 * Review content and engagement are delegated to the shared ReviewContent
 * component, while editing, deletion, reporting, and merchant responses remain
 * specific to this card's context.
 */
export default function BusinessReviewCard({
  businessId,
  review,
  onEdit,
}: Props) {
  const { mutateAsync: like, isPending: isLikePending } =
    useReviewLike(businessId);

  const { mutateAsync: deleteReview, isPending: isDeletePending } =
    useDeleteReview(businessId);

  const { mutateAsync: reportReview } = useReportReview(businessId);

  const [isDeleteVisible, setIsDeleteVisible] = useState(false);

  const actionSheetRef = useRef<BottomSheetModal | null>(null);
  const reportSheetRef = useRef<BottomSheetModal | null>(null);

  const toggleLike = async () => {
    try {
      await like({
        reviewId: review.id,
        isLiked: review.is_liked,
      });
    } catch (error) {
      const response = error as ApiResponse<unknown>;

      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to update like",
          text2: response.message || "Please try again.",
        });
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteReview({
        reviewId: review.id,
      });

      Toast.show({
        type: "success",
        text1: "Review deleted",
        visibilityTime: 1500,
      });

      setIsDeleteVisible(false);
    } catch (error) {
      const response = error as ApiResponse<unknown>;

      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to delete review",
          text2: response.message || "Please try again.",
        });
      }
    }
  };

  const handleReport = async (value: string) => {
    try {
      await reportReview({
        reviewId: review.id,
        reportType: value as "spam" | "abuse" | "misinformation" | "other",
      });

      Toast.show({
        type: "info",
        text1: "Review reported",
        visibilityTime: 1500,
      });
    } catch (error) {
      const response = error as ApiResponse<unknown>;

      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to report review",
          text2: response.message || "Please try again.",
        });
      }
    }
  };

  return (
    <View className="rounded-card border border-border-primary bg-surface px-4 py-5">
      {/* Shared review content */}
      <ReviewContent
        review={review}
        onLike={toggleLike}
        isLikePending={isLikePending}
        onActions={() => presentBottomSheet(actionSheetRef)}
      />

      {/* Merchant response */}
      {review.reply && <MerchantReviewResponse reply={review.reply} />}

      {/* Review actions */}
      <ActionBottomSheet
        sheetRef={actionSheetRef}
        options={
          review.is_own_review
            ? [
                {
                  label: "Edit my review",
                  value: "edit",
                },
                {
                  label: "Delete my review",
                  value: "delete",
                  color: theme.extends.colors.error,
                },
              ]
            : [
                {
                  label: "Report review",
                  value: "report",
                  color: theme.extends.colors.error,
                },
              ]
        }
        onSelect={(value) => {
          if (value === "edit") {
            onEdit?.(review);
          }

          if (value === "delete") {
            setIsDeleteVisible(true);
          }

          if (value === "report") {
            presentBottomSheet(reportSheetRef);
          }
        }}
      />

      {/* Report review */}
      <SelectionBottomSheet
        sheetRef={reportSheetRef}
        title="Report review"
        description="Why are you reporting this review?"
        options={[
          {
            label: "Spam",
            value: "spam",
          },
          {
            label: "Abuse",
            value: "abuse",
          },
          {
            label: "Misinformation",
            value: "misinformation",
          },
          {
            label: "Other",
            value: "other",
          },
        ]}
        onSelect={handleReport}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        visible={isDeleteVisible}
        title="Delete review?"
        message="This review and its uploaded photos will be permanently deleted."
        confirmText="Delete"
        destructive
        isLoading={isDeletePending}
        loadingText="Deleting review..."
        onCancel={() => setIsDeleteVisible(false)}
        onConfirm={handleDelete}
      />
    </View>
  );
}
