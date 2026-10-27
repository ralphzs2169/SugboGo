import { useRef, useState, type ComponentProps } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";
import Toast from "react-native-toast-message";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import AppText from "@/shared/components/AppText";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import ActionBottomSheet from "@/shared/components/bottom-sheets/ActionBottomSheet";
import { theme } from "@/constants/theme";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { useAuthStore } from "@/features/auth/store/auth.store";

import { useDeleteReview } from "../../../hooks/useBusinessReviews";
import { useReviewLike } from "../../../hooks/useReviewLike";
import { useAuthorReviewSource } from "../../../hooks/useAuthorReviewSource";
import { useReviewWorkflowStore } from "../../../stores/reviewWorkflow.store";
import type { BusinessReview } from "../../../types/review.types";
import { canEditReview } from "../../../utils/reviewModeration.utils";
import MerchantReviewResponse from "./MerchantReviewResponse";
import ReviewContent from "./ReviewContent";
import AuthorReviewStatus from "./AuthorReviewStatus";
import ReportReviewSheet from "./ReportReviewSheet";
import ReviewReportReceiptSheet from "./ReviewReportReceiptSheet";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
} from "../../../hooks/reviewQueryKeys";

type Props = {
  businessId: number;
  review: BusinessReview;
  onEdit?: (review: BusinessReview) => void;
  isLast?: boolean;
  highlightedTopic?: string | null;
};

/** Presents review content with author progress and merchant responses. */
function ReviewCardContent({
  review,
  saving = false,
  ...contentProps
}: Omit<ComponentProps<typeof ReviewContent>, "showEngagement" | "review"> & {
  review: BusinessReview;
  saving?: boolean;
}) {
  return (
    <>
      <ReviewContent
        {...contentProps}
        review={review}
        showEngagement={review.status === "published"}
      />
      {review.is_own_review && saving && (
        <AppText
          accessibilityLiveRegion="polite"
          className="mt-2 text-xs text-text-secondary"
        >
          Saving changes…
        </AppText>
      )}
      {review.is_own_review && <AuthorReviewStatus review={review} />}
      {review.reply && <MerchantReviewResponse reply={review.reply} />}
    </>
  );
}

/**
 * Presents a customer review in the explorer business profile.
 *
 * Review content and engagement are delegated to the shared ReviewContent
 * component, while editing, deletion, reporting, and merchant responses remain
 * specific to this card's context.
 */
export default function BusinessReviewCard({
  businessId,
  review: suppliedReview,
  onEdit,
  isLast = false,
  highlightedTopic,
}: Props) {
  const review = useAuthorReviewSource(businessId, suppliedReview);
  const saving = useReviewWorkflowStore((state) =>
    Boolean(state.edits[review.id]),
  );
  const { mutateAsync: like, isPending: isLikePending } = useReviewLike(
    businessId,
    review.id,
  );

  const { mutateAsync: deleteReview, isPending: isDeletePending } =
    useDeleteReview(businessId);

  const [isDeleteVisible, setIsDeleteVisible] = useState(false);
  const [reportedByUserId, setReportedByUserId] = useState<number | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  const hasReported = review.has_reported || reportedByUserId === userId;

  const actionSheetRef = useRef<BottomSheetModal | null>(null);
  const reportSheetRef = useRef<BottomSheetModal | null>(null);
  const receiptSheetRef = useRef<BottomSheetModal | null>(null);

  const handleReported = () => {
    setReportedByUserId(userId ?? null);
    void queryClient.invalidateQueries({
      queryKey: businessReviewPreviewKey(businessId),
    });
    void queryClient.invalidateQueries({
      queryKey: businessReviewsKey(businessId),
    });
    void queryClient.invalidateQueries({
      queryKey: ["my-review-report", userId, review.id],
    });
  };

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

  return (
    <View
      className={`border-t border-border-primary bg-surface px-4 py-5 ${
        isLast ? "border-b" : ""
      }`}
    >
      {/* Shared review content */}
      <ReviewCardContent
        review={review}
        onLike={toggleLike}
        isLikePending={isLikePending}
        onActions={() => presentBottomSheet(actionSheetRef)}
        highlightedTopic={highlightedTopic}
        saving={saving}
      />

      {/* Review actions */}
      <ActionBottomSheet
        sheetRef={actionSheetRef}
        options={
          review.is_own_review
            ? [
                ...(canEditReview(review)
                  ? [{ label: "Edit my review", value: "edit" }]
                  : []),
                {
                  label: "Delete my review",
                  value: "delete",
                  color: theme.extends.colors.error,
                },
              ]
            : [
                {
                  label: hasReported ? "View your report" : "Report review",
                  value: hasReported ? "view-report" : "report",
                  color: hasReported ? undefined : theme.extends.colors.error,
                },
              ]
        }
        onSelect={(value) => {
          if (value === "edit" && review.is_own_review && canEditReview(review)) {
            onEdit?.(review);
          }

          if (value === "delete") {
            setIsDeleteVisible(true);
          }

          if (value === "report") {
            presentBottomSheet(reportSheetRef);
          }

          if (value === "view-report") {
            setReceiptOpen(true);
            presentBottomSheet(receiptSheetRef);
          }
        }}
      />

      {/* Report review */}
      <ReportReviewSheet
        sheetRef={reportSheetRef}
        businessId={businessId}
        reviewId={review.id}
        onReported={handleReported}
      />

      <ReviewReportReceiptSheet
        sheetRef={receiptSheetRef}
        reviewId={review.id}
        isOpen={receiptOpen}
        onDismiss={() => setReceiptOpen(false)}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        visible={isDeleteVisible}
        title="Delete review?"
        message="Your review will be removed from SugboGo review surfaces. Moderation or dispute records may be retained for platform integrity."
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
