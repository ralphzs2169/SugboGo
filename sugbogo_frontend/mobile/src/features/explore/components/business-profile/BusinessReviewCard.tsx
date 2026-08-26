import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import Avatar from "@/shared/components/Avatar";
import ImagePreviewModal from "@/shared/components/modals/ImagePreviewModal";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import {
  useDeleteReview,
  useReportReview,
  useReviewLike,
} from "../../hooks/useBusinessReviews";
import type { BusinessReview } from "../../types/review.types";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";

type Props = {
  businessId: number;
  review: BusinessReview;
  businessName: string;
  onEdit?: (review: BusinessReview) => void;
};

function relativeDate(value: string) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
  );

  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

/**
 * Renders a business review with author identity, photos, engagement,
 * merchant response, and ownership-specific actions for the authenticated
 * user's own review.
 */
export default function BusinessReviewCard({
  businessId,
  review,
  businessName,
  onEdit,
}: Props) {
  const { mutateAsync: like, isPending: isLikePending } =
    useReviewLike(businessId);

  const { mutateAsync: deleteReview, isPending: isDeletePending } =
    useDeleteReview(businessId);
  const { mutateAsync: reportReview } = useReportReview(businessId);

  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isDeleteVisible, setIsDeleteVisible] = useState(false);
  const actionSheetRef = useRef<BottomSheetModal | null>(null);
  const reportSheetRef = useRef<BottomSheetModal | null>(null);

  const scale = useRef(new Animated.Value(1)).current;

  const toggleLike = async () => {
    try {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

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
      if (!response.success && !handleSystemError(response))
        Toast.show({
          type: "error",
          text1: "Unable to report review",
          text2: response.message || "Please try again.",
        });
    }
  };

  return (
    <View className="rounded-card border border-border-primary bg-white p-4">
      {/* Review author */}
      <View className="flex-row items-center">
        <Avatar imageUrl={review.author.avatar_url} size={38} />

        <View className="ml-3 flex-1">
          <View className="flex-row items-center">
            <Text className="font-semibold text-text-primary">
              {review.author.first_name} {review.author.last_name}
            </Text>

            {review.is_own_review && (
              <View className="ml-2 rounded-full bg-brand/10 px-2 py-0.5">
                <Text className="text-[10px] font-semibold text-brand">
                  Your review
                </Text>
              </View>
            )}
          </View>

          <Text className="mt-0.5 text-xs text-text-secondary">
            {relativeDate(review.created_at)}
          </Text>
        </View>

        <Pressable
          onPress={() => presentBottomSheet(actionSheetRef)}
          className="cursor-pointer p-1 active:opacity-70"
        >
          <MaterialCommunityIcons
            name="dots-vertical"
            size={22}
            color="#64748B"
          />
        </Pressable>
      </View>

      {/* Review content */}
      <Text className="mt-3 text-sm leading-5 text-text-primary">
        {review.text}
      </Text>

      {/* Review photos */}
      {review.photos.length > 0 && (
        <View className="mt-3 flex-row gap-2">
          {review.photos.map((photo) => (
            <Pressable
              key={photo.id}
              onPress={() => setPreviewUri(photo.photo_url)}
              className="aspect-square flex-1 cursor-pointer overflow-hidden rounded-lg active:opacity-80"
            >
              <Image
                source={{ uri: photo.photo_url }}
                style={{
                  width: "100%",
                  height: "100%",
                }}
                contentFit="cover"
              />
            </Pressable>
          ))}
        </View>
      )}

      {/* Reviewer-vouched specialties */}
      {review.vouched_specialties.length > 0 && (
        <View className="mt-3 flex-row flex-wrap">
          {review.vouched_specialties.map((tag) => (
            <SpecialtyTagChip
              key={tag.id}
              tag={{
                name: tag.name,
                color: tag.color,
              }}
              size="small"

              showVouchIndicator
            />
          ))}
        </View>
      )}

      {/* Review actions */}
      <Pressable
        onPress={toggleLike}
        disabled={isLikePending}
        className="mt-3 flex-row items-center self-start cursor-pointer active:opacity-70"
      >
        <Animated.View
          style={{
            transform: [{ scale }],
          }}
        >
          <MaterialCommunityIcons
            name={review.is_liked ? "heart" : "heart-outline"}
            size={22}
            color={review.is_liked ? "#E11D48" : "#64748B"}
          />
        </Animated.View>

        <Text className="ml-1.5 text-sm text-text-secondary">
          {review.like_count}
        </Text>
      </Pressable>

      {/* Merchant response */}
      {review.reply && (
        <View className="mt-4 rounded-lg bg-surface-secondary p-3">
          <Text className="text-xs font-bold uppercase tracking-wide text-text-secondary">
            {businessName} response
          </Text>

          <Text className="mt-1 text-sm text-text-primary">
            {review.reply.text}
          </Text>

          {review.reply.photos.length > 0 && (
            <View className="mt-2 flex-row gap-2">
              {review.reply.photos.map((photo) => (
                <Pressable
                  key={photo.id}
                  onPress={() => setPreviewUri(photo.photo_url)}
                  className="h-20 w-20 cursor-pointer overflow-hidden rounded-lg active:opacity-80"
                >
                  <Image
                    source={{ uri: photo.photo_url }}
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                    contentFit="cover"
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Full-screen photo preview */}
      <ImagePreviewModal
        uri={previewUri}
        visible={Boolean(previewUri)}
        onClose={() => setPreviewUri(null)}
      />
      <SelectionBottomSheet
        sheetRef={actionSheetRef}

        options={
          review.is_own_review
            ? [
                { label: "Edit review", value: "edit", icon: "pencil" },
                {
                  label: "Delete review",
                  value: "delete",
                  icon: "delete-outline",
                  color: "#DC2626",
                },
              ]
            : [
                {
                  label: "Report review",
                  value: "report",
                  icon: "flag-outline",
                  color: "#DC2626",
                },
              ]
        }
        onSelect={(value) => {
          if (value === "edit") onEdit?.(review);
          if (value === "delete") setIsDeleteVisible(true);
          if (value === "report") presentBottomSheet(reportSheetRef);
        }}
      />
      <SelectionBottomSheet
        sheetRef={reportSheetRef}
        title="Report review"
        description="Why are you reporting this review?"
        options={[
          { label: "Spam", value: "spam" },
          { label: "Abuse", value: "abuse" },
          { label: "Misinformation", value: "misinformation" },
          { label: "Other", value: "other" },
        ]}
        onSelect={handleReport}
      />
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
