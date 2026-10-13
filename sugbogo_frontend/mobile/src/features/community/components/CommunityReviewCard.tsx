import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { useReviewLike } from "@/features/explore/hooks/useReviewLike";
import MerchantReviewResponse from "@/features/explore/components/business-profile/reviews/MerchantReviewResponse";
import AppText from "@/shared/components/AppText";
import Avatar from "@/shared/components/Avatar";
import FullScreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { MAX_REVIEW_PHOTOS } from "@/shared/constants/media.constants";
import { shadows } from "@/shared/styles/shadows";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import type { CommunityReview } from "../types/communityReview.types";
import CommunityBusinessLink from "./CommunityBusinessLink";

type Props = {
  review: CommunityReview;
};

const MAX_REVIEW_LINES = 5;

function formatRelativeDate(value: string) {
  const elapsedDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000),
  );

  if (elapsedDays === 0) return "Today";
  if (elapsedDays === 1) return "Yesterday";
  if (elapsedDays < 7) return `${elapsedDays} days ago`;
  if (elapsedDays < 30) return `${Math.floor(elapsedDays / 7)}w ago`;
  if (elapsedDays < 365) return `${Math.floor(elapsedDays / 30)}mo ago`;
  return `${Math.floor(elapsedDays / 365)}y ago`;
}

/**
 * Displays one public Community review with its linked business context.
 *
 * Helpful interactions receive local optimistic feedback while established
 * shared viewers, specialty chips, and merchant-response presentation remain
 * consistent with business-profile reviews.
 */
export default function CommunityReviewCard({ review }: Props) {
  const { mutateAsync: like, isPending: isLikePending } = useReviewLike(
    review.business.id,
    review.id,
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isPhotoViewerVisible, setIsPhotoViewerVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const toggleHelpful = async () => {
    if (isLikePending) {
      return;
    }

    try {
      await like({
        reviewId: review.id,
        isLiked: review.is_liked,
      });
    } catch (error) {
      const response = error as unknown as ApiResponse<unknown>;

      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to update helpful",
          text2: response.message || "Please try again.",
        });
      }
    }
  };

  const openPhoto = (index: number) => {
    setSelectedPhotoIndex(index);
    setIsPhotoViewerVisible(true);
  };

  return (
    <View
      testID={`community-review-${review.id}`}
      className="rounded-card border border-border-primary bg-surface p-4"
      style={shadows.subtle}
    >
      {/* Reviewer identity */}
      <View className="flex-row items-center">
        <Avatar
          imageUrl={review.author.avatar_url}
          avatarKey={review.author.avatar_key}
          size={38}
        />

        <View className="ml-2.5 min-w-0 flex-1">
          <View className="flex-row items-center">
            <AppText
              weight="semibold"
              className="min-w-0 shrink text-sm text-text-primary"
              numberOfLines={1}
            >
              {review.author.first_name} {review.author.last_name}
            </AppText>

            {review.is_own_review && (
              <View className="ml-2 rounded-full bg-brand/10 px-2 py-0.5">
                <AppText
                  weight="semibold"
                  className="text-[10px] text-text-primary"
                >
                  You
                </AppText>
              </View>
            )}
          </View>

          <AppText className="mt-0.5 text-[11px] text-text-secondary">
            {formatRelativeDate(review.created_at)}
          </AppText>
        </View>
      </View>

      {/* Linked business */}
      <CommunityBusinessLink business={review.business} />

      {/* Review text */}
      <View className="mt-4">
        <AppText
          className="text-sm leading-[21px] text-text-primary"
          numberOfLines={
            isExpanded ? undefined : isTruncated ? MAX_REVIEW_LINES : undefined
          }
          onTextLayout={(event) => {
            if (!isExpanded && !isTruncated) {
              setIsTruncated(event.nativeEvent.lines.length > MAX_REVIEW_LINES);
            }
          }}
        >
          {review.text}
        </AppText>

        {isTruncated && (
          <Pressable
            onPress={() => setIsExpanded((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded ? "Show less of review" : "Read full review"
            }
            accessibilityState={{ expanded: isExpanded }}
            hitSlop={8}
            className="mt-1 min-h-12 cursor-pointer self-start justify-center active:opacity-70"
          >
            <AppText
              weight="semibold"
              className="text-xs text-text-primary underline"
            >
              {isExpanded ? "Show less" : "Read more"}
            </AppText>
          </Pressable>
        )}
      </View>

      {/* Review photos */}
      {review.photos.length > 0 && (
        <View className="mt-3 flex-row flex-wrap gap-1.5">
          {review.photos.slice(0, MAX_REVIEW_PHOTOS).map((photo, index) => (
            <Pressable
              key={photo.id}
              onPress={() => openPhoto(index)}
              accessibilityRole="button"
              accessibilityLabel={`View review photo ${index + 1}`}
              className="aspect-square w-[32%] cursor-pointer overflow-hidden rounded-lg bg-surface-muted active:opacity-90"
            >
              <Image
                source={{ uri: photo.photo_url }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={150}
              />

              {index === MAX_REVIEW_PHOTOS - 1 &&
                review.photos.length > MAX_REVIEW_PHOTOS && (
                  <View className="absolute inset-0 items-center justify-center bg-black/65">
                    <AppText weight="bold" className="text-base text-white">
                      +{review.photos.length - MAX_REVIEW_PHOTOS}
                    </AppText>
                  </View>
                )}
            </Pressable>
          ))}
        </View>
      )}

      {/* Specialty vouches */}
      {review.vouched_specialties.length > 0 && (
        <View className="mt-3">
          <View className="mb-1.5 flex-row items-center">
            <MaterialCommunityIcons
              name="heart-outline"
              size={14}
              color={theme.extends.colors.brand}
            />
            <AppText
              weight="medium"
              className="ml-1 text-[11px] text-text-secondary"
            >
              Vouched for
            </AppText>
          </View>

          <View className="flex-row flex-wrap">
            {review.vouched_specialties.map((tag) => (
              <SpecialtyTagChip
                key={tag.id}
                tag={tag}
                size="small"
                isSelected
                showVouchIndicator
                showIcon
              />
            ))}
          </View>
        </View>
      )}

      {/* Helpful interaction */}
      <View className="mt-3 flex-row items-center">
        <Pressable
          onPress={toggleHelpful}
          disabled={isLikePending}
          accessibilityRole="button"
          accessibilityLabel={
            review.is_liked
              ? "Remove helpful from this review"
              : "Mark review helpful"
          }
          accessibilityState={{
            selected: review.is_liked,
            disabled: isLikePending,
          }}
          className="min-h-12 cursor-pointer flex-row items-center rounded-full pr-3 active:opacity-70 disabled:opacity-50"
        >
          <MaterialCommunityIcons
            name={review.is_liked ? "thumb-up" : "thumb-up-outline"}
            size={18}
            color={
              review.is_liked
                ? theme.extends.colors.text.primary
                : theme.extends.colors.text.secondary
            }
          />

          <AppText
            weight="medium"
            className={`ml-1.5 text-xs ${
              review.is_liked ? "text-text-primary" : "text-text-secondary"
            }`}
          >
            {review.like_count > 0
              ? `${review.like_count} helpful`
              : "Helpful?"}
          </AppText>
        </Pressable>

        {review.is_liked_by_owner && (
          <View className="ml-2 flex-row items-center">
            <MaterialCommunityIcons
              name="heart"
              size={15}
              color={theme.extends.colors.brand}
            />
            <AppText
              weight="medium"
              className="ml-1 text-xs text-text-secondary"
            >
              Liked by merchant
            </AppText>
          </View>
        )}
      </View>

      {/* Merchant response */}
      {review.reply && <MerchantReviewResponse reply={review.reply} />}

      {/* Fullscreen review photo gallery */}
      <FullScreenPhotoViewer
        photos={review.photos.map((photo) => ({ uri: photo.photo_url }))}
        visible={isPhotoViewerVisible}
        initialIndex={selectedPhotoIndex}
        onClose={() => setIsPhotoViewerVisible(false)}
        headerContent={
          <View className="ml-3 flex-1 flex-row items-center">
            <Avatar
              imageUrl={review.author.avatar_url}
              avatarKey={review.author.avatar_key}
              size={34}
            />

            <View className="ml-2.5 min-w-0 flex-1">
              <AppText
                weight="semibold"
                className="text-sm text-white"
                numberOfLines={1}
              >
                {review.author.first_name} {review.author.last_name}
              </AppText>
              <AppText className="mt-0.5 text-xs text-white/65">
                {formatRelativeDate(review.created_at)}
              </AppText>
            </View>
          </View>
        }
      />
    </View>
  );
}
