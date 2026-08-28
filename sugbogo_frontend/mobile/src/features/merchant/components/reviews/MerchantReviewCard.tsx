import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import type { BusinessReview } from "@/features/explore/types/review.types";
import { useDeleteReviewReply } from "@/features/explore/hooks/useBusinessReviews";
import { theme } from "@/constants/theme";
import Avatar from "@/shared/components/Avatar";
import ActionBottomSheet from "@/shared/components/bottom-sheets/ActionBottomSheet";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import FullScreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

type Props = {
  businessId: number;
  review: BusinessReview;
  onReply: (review: BusinessReview) => void;
};

const MAX_VISIBLE_PHOTOS = 3;

function relativeDate(value: string) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
  );

  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

/**
 * Shows a customer review in a merchant-management context.
 *
 * Merchant reply controls are prominent, while Explorer-only review editing
 * and reporting actions are deliberately excluded.
 */
export default function MerchantReviewCard({
  businessId,
  review,
  onReply,
}: Props) {
  const { mutateAsync: deleteReply, isPending: isDeletePending } =
    useDeleteReviewReply(businessId);

  const actionSheetRef = useRef<BottomSheetModal | null>(null);

  const [isDeleteVisible, setIsDeleteVisible] = useState(false);
  const [isPhotoViewerVisible, setIsPhotoViewerVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const openPhotos = (index: number) => {
    setSelectedPhotoIndex(index);
    setIsPhotoViewerVisible(true);
  };

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

  return (
    <View className="rounded-card border border-border-primary bg-surface p-4">
      <View className="flex-row items-center">
        <Avatar imageUrl={review.author.avatar_url} size={40} />

        <View className="ml-3 flex-1">
          <Text className="font-semibold text-text-primary">
            {review.author.first_name} {review.author.last_name}
          </Text>

          <Text className="mt-0.5 text-xs text-text-secondary">
            {relativeDate(review.created_at)}
          </Text>
        </View>

        {review.reply && (
          <Pressable
            onPress={() => presentBottomSheet(actionSheetRef)}
            accessibilityRole="button"
            accessibilityLabel="Manage reply"
            className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-secondary"
          >
            <MaterialCommunityIcons
              name="dots-vertical"
              size={20}
              color={theme.extends.colors.text.tertiary}
            />
          </Pressable>
        )}
      </View>

      <Text className="mt-3 text-sm leading-5 text-text-primary">
        {review.text}
      </Text>

      {review.photos.length > 0 && (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {review.photos.slice(0, MAX_VISIBLE_PHOTOS).map((photo, index) => (
            <Pressable
              key={photo.id}
              onPress={() => openPhotos(index)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Open review photo ${index + 1}`}
              className="aspect-square w-[31%] overflow-hidden rounded-lg bg-surface-secondary active:opacity-90"
            >
              <Image
                source={{ uri: photo.photo_url }}
                contentFit="cover"
                transition={150}
                style={{
                  width: "100%",
                  height: "100%",
                }}
              />

              {index === MAX_VISIBLE_PHOTOS - 1 &&
                review.photos.length > MAX_VISIBLE_PHOTOS && (
                  <View className="absolute inset-0 items-center justify-center bg-black/45">
                    <Text className="text-lg font-bold text-white">
                      +{review.photos.length - MAX_VISIBLE_PHOTOS}
                    </Text>
                  </View>
                )}
            </Pressable>
          ))}
        </View>
      )}

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

      <View className="mt-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <MaterialCommunityIcons
            name="thumb-up-outline"
            size={18}
            color={theme.extends.colors.text.secondary}
          />

          <Text className="ml-1.5 text-sm text-text-secondary">
            {review.like_count}
          </Text>
        </View>

        {!review.reply && (
          <Pressable
            onPress={() => onReply(review)}
            accessibilityRole="button"
            accessibilityLabel={`Reply to ${review.author.first_name} ${review.author.last_name}'s review`}
            className="min-h-11 justify-center rounded-full bg-brand px-4 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-white">Reply</Text>
          </Pressable>
        )}
      </View>

      {review.reply ? (
        <View className="mt-4 rounded-lg bg-surface-secondary p-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold uppercase tracking-wide text-text-secondary">
              Your response
            </Text>

            <Pressable
              onPress={() => onReply(review)}
              accessibilityRole="button"
              accessibilityLabel="Edit reply"
              className="min-h-11 justify-center px-1 active:opacity-70"
            >
              <Text className="text-xs font-semibold text-brand">Edit</Text>
            </Pressable>
          </View>

          <Text className="mt-1 text-sm leading-5 text-text-primary">
            {review.reply.text}
          </Text>

          {review.reply.photos.length > 0 && (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {review.reply.photos.map((photo) => (
                <View
                  key={photo.id}
                  className="h-20 w-20 overflow-hidden rounded-lg"
                >
                  <Image
                    source={{ uri: photo.photo_url }}
                    contentFit="cover"
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
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

      <FullScreenPhotoViewer
        photos={review.photos.map((photo) => ({
          uri: photo.photo_url,
        }))}
        visible={isPhotoViewerVisible}
        initialIndex={selectedPhotoIndex}
        onClose={() => setIsPhotoViewerVisible(false)}
      />

      <ActionBottomSheet
        sheetRef={actionSheetRef}
        options={[
          {
            label: "Edit reply",
            value: "edit",
          },
          {
            label: "Delete reply",
            value: "delete",
            color: theme.extends.colors.error,
          },
        ]}
        onSelect={(value) => {
          if (value === "edit") {
            onReply(review);
          }

          if (value === "delete") {
            setIsDeleteVisible(true);
          }
        }}
      />

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
