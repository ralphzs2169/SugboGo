import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import Avatar from "@/shared/components/Avatar";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import FullScreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { theme } from "@/constants/theme";

import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import ActionBottomSheet from "@/shared/components/bottom-sheets/ActionBottomSheet";
import {
  useDeleteReview,
  useReportReview,
} from "../../hooks/useBusinessReviews";
import { useReviewLike } from "../../hooks/useReviewLike";
import type { BusinessReview } from "../../types/review.types";

type Props = {
  businessId: number;
  review: BusinessReview;
  businessName: string;
  onEdit?: (review: BusinessReview) => void;
};

const MAX_PHOTOS = 3;

function relativeDate(value: string) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
  );

  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

/**
 * Renders a flat business review with author identity, review content,
 * compact photo previews, specialty vouches, engagement, and merchant
 * responses.
 *
 * Review photos open in the reusable fullscreen viewer with review context.
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

  const [isPhotoViewerVisible, setIsPhotoViewerVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isDeleteVisible, setIsDeleteVisible] = useState(false);

  const actionSheetRef = useRef<BottomSheetModal | null>(null);
  const reportSheetRef = useRef<BottomSheetModal | null>(null);

  const scale = useRef(new Animated.Value(1)).current;

  const handlePhotoPress = (index: number) => {
    setSelectedPhotoIndex(index);
    setIsPhotoViewerVisible(true);
  };

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
    <View className="border-b border-border-primary bg-surface px-4 py-4">
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
            size={18}
            color={theme.extends.colors.text.tertiary}
          />
        </Pressable>
      </View>

      {/* Review content */}
      <Text className="mt-3 text-sm leading-5 text-text-primary">
        {review.text}
      </Text>

      {/* Review photos */}
      {review.photos.length > 0 && (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {review.photos.slice(0, MAX_PHOTOS).map((photo, index) => (
            <Pressable
              key={photo.id}
              onPress={() => handlePhotoPress(index)}
              className="aspect-square w-[31%] cursor-pointer overflow-hidden rounded-lg bg-surface-secondary active:opacity-90"
            >
              <Image
                source={{ uri: photo.photo_url }}
                style={{
                  width: "100%",
                  height: "100%",
                }}
                contentFit="cover"
                transition={150}
              />

              {/* Additional photo count */}
              {index === MAX_PHOTOS - 1 &&
                review.photos.length > MAX_PHOTOS && (
                  <View className="absolute inset-0 items-center justify-center bg-black/45">
                    <Text className="text-lg font-bold text-white">
                      +{review.photos.length - MAX_PHOTOS}
                    </Text>
                  </View>
                )}
            </Pressable>
          ))}
        </View>
      )}

      {/* Specialty vouches */}
      {review.vouched_specialties.length > 0 && (
        <View className="mt-4">
          <View className="mb-2 flex-row items-center">
            <MaterialCommunityIcons
              name="check-decagram-outline"
              size={16}
              color={theme.extends.colors.brand}
            />

            <Text className="ml-1.5 text-xs font-semibold text-text-secondary">
              Vouched for
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-2">
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
        </View>
      )}

      {/* Review like action */}
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
            name={review.is_liked ? "thumb-up" : "thumb-up-outline"}
            size={21}
            color={
              review.is_liked
                ? theme.extends.colors.brand
                : theme.extends.colors.text.secondary
            }
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
                <View
                  key={photo.id}
                  className="h-20 w-20 overflow-hidden rounded-lg"
                >
                  <Image
                    source={{ uri: photo.photo_url }}
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                    contentFit="cover"
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Fullscreen review photo gallery */}
      <FullScreenPhotoViewer
        photos={review.photos.map((photo) => ({
          uri: photo.photo_url,
        }))}
        visible={isPhotoViewerVisible}
        initialIndex={selectedPhotoIndex}
        onClose={() => setIsPhotoViewerVisible(false)}
        headerContent={
          <View className="ml-3 flex-1 flex-row items-center">
            <Avatar imageUrl={review.author.avatar_url} size={34} />

            <View className="ml-2.5 flex-1">
              <Text
                className="text-sm font-semibold text-white"
                numberOfLines={1}
              >
                {review.author.first_name} {review.author.last_name}
              </Text>

              <Text className="mt-0.5 text-xs text-white/65">
                {relativeDate(review.created_at)}
              </Text>
            </View>
          </View>
        }
      />

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
                  color: "#DC2626",
                },
              ]
            : [
                {
                  label: "Report review",
                  value: "report",
                  color: "#DC2626",
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
