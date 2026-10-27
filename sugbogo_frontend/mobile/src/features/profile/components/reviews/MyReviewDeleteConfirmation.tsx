import { useEffect, useRef } from "react";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { useDeleteReview } from "@/features/explore/hooks/useBusinessReviews";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import type { MyReview } from "../../types/myReview.types";

/** Confirms one stable submission and retains it for retry after failed deletion. */
export default function MyReviewDeleteConfirmation({
  review,
  userId,
  onClose,
}: {
  review: MyReview;
  userId: number;
  onClose: () => void;
}) {
  const deletion = useDeleteReview(review.business.id);
  const submissionPending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const cancel = () => {
    if (!submissionPending.current && !deletion.isPending) onClose();
  };

  const confirm = async () => {
    const session = useAuthStore.getState();
    if (
      submissionPending.current ||
      deletion.isPending ||
      !session.isAuthenticated ||
      session.isLoading ||
      session.user?.id !== userId
    )
      return;

    submissionPending.current = true;
    try {
      await deletion.mutateAsync({ reviewId: review.id });
      if (!mounted.current || useAuthStore.getState().user?.id !== userId)
        return;
      onClose();
      Toast.show({
        type: "success",
        text1: "Review deleted",
        visibilityTime: 1500,
      });
    } catch (error) {
      if (!mounted.current || useAuthStore.getState().user?.id !== userId)
        return;
      const response = error as ApiResponse<unknown>;
      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to delete review",
          text2: response.message || "Please try again.",
        });
      }
    } finally {
      submissionPending.current = false;
    }
  };

  return (
    /* Shared destructive confirmation and pending feedback */
    <ConfirmModal
      visible
      title="Delete this review?"
      message="Your review will be removed from SugboGo review surfaces. Moderation or dispute records may be retained for platform integrity."
      confirmText="Delete review"
      cancelText="Cancel"
      destructive
      isLoading={deletion.isPending}
      loadingText="Deleting review..."
      onCancel={cancel}
      onConfirm={() => void confirm()}
    />
  );
}
