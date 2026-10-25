import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { Animated, Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import HighlightedText from "@/shared/components/HighlightedText";
import Avatar from "@/shared/components/Avatar";
import FullScreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { MAX_REVIEW_PHOTOS } from "@/shared/constants/media.constants";

import type { BusinessReview } from "../../../types/review.types";

type ReviewContentReview = Pick<
  BusinessReview,
  "author" | "created_at" | "text" | "photos"
> &
  Partial<
    Pick<
      BusinessReview,
      | "is_own_review"
      | "vouched_specialties"
      | "like_count"
      | "is_liked"
      | "is_liked_by_owner"
      | "reply"
    >
  >;

type Props = {
  review: ReviewContentReview;
  onLike?: () => void;
  isLikePending?: boolean;
  onActions?: () => void;
  onReply?: () => void;
  perspective?: "explorer" | "merchant";
  showEngagement?: boolean;
  showSpecialtyVouches?: boolean;
  showAuthor?: boolean;
  highlightedTopic?: string | null;
};

const MAX_REVIEW_LINES = 5;

function relativeDate(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const days = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 86400000),
  );

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }

  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/**
 * Renders the shared content and interactions for a business review.
 *
 * Uses a compact visual hierarchy while supporting review highlighting,
 * photos, specialty vouches, engagement, replies, and photo viewing.
 */
export default function ReviewContent({
  review,
  onLike,
  isLikePending = false,
  onActions,
  onReply,
  perspective = "explorer",
  showEngagement = true,
  showSpecialtyVouches = true,
  showAuthor = true,
  highlightedTopic,
}: Props) {
  const [isPhotoViewerVisible, setIsPhotoViewerVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  const [scale] = useState(() => new Animated.Value(1));

  const vouchedSpecialties = review.vouched_specialties ?? [];
  const likeCount = review.like_count ?? 0;
  const isLiked = review.is_liked ?? false;
  const isLikedByOwner = review.is_liked_by_owner ?? false;

  const handlePhotoPress = (index: number) => {
    setSelectedPhotoIndex(index);
    setIsPhotoViewerVisible(true);
  };

  const handleLike = () => {
    if (!onLike || isLikePending) {
      return;
    }

    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.15,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start();

    onLike();
  };

  return (
    <>
      {/* Reviewer identity */}
      {showAuthor && (
        <View className="flex-row items-center">
          <Avatar
            imageUrl={review.author.avatar_url}
            avatarKey={review.author.avatar_key}
            size={36}
          />

          <View className="ml-2.5 flex-1">
            <View className="flex-row items-center">
              <AppText
                weight="semibold"
                className="flex-shrink text-sm text-text-primary"
                numberOfLines={1}
              >
                {review.author.first_name} {review.author.last_name}
              </AppText>

              {review.is_own_review && (
                <View className="ml-2 rounded-full bg-brand/10 px-2 py-0.5">
                  <AppText weight="semibold" className="text-[10px] text-brand">
                    You
                  </AppText>
                </View>
              )}
            </View>

            <AppText className="mt-0.5 text-[11px] text-text-tertiary">
              {relativeDate(review.created_at)}
            </AppText>
          </View>

          {onActions && (
            <Pressable
              onPress={onActions}
              accessibilityRole="button"
              accessibilityLabel="Review actions"
              hitSlop={8}
              className="ml-2 cursor-pointer rounded-full p-1.5 active:bg-surface-secondary"
            >
              <MaterialCommunityIcons
                name="dots-horizontal"
                size={20}
                color={theme.extends.colors.text.tertiary}
              />
            </Pressable>
          )}
        </View>
      )}

      {/* Review text */}
      <View className="mt-3">
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
          <HighlightedText
            text={review.text}
            query={highlightedTopic}
            highlightTestID="review-topic-highlight"
          />
        </AppText>

        {isTruncated && (
          <Pressable
            onPress={() => setIsExpanded((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded ? "Show less of review" : "Read full review"
            }
            className="mt-1 cursor-pointer self-start active:opacity-70"
          >
            <AppText weight="semibold" className="text-xs text-brand">
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
              onPress={() => handlePhotoPress(index)}
              accessibilityRole="button"
              accessibilityLabel={`View review photo ${index + 1}`}
              className="aspect-square w-[32%] cursor-pointer overflow-hidden rounded-lg bg-surface-secondary active:opacity-90"
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

              {index === MAX_REVIEW_PHOTOS - 1 &&
                review.photos.length > MAX_REVIEW_PHOTOS && (
                  <View className="absolute inset-0 items-center justify-center bg-black/45">
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
      {showSpecialtyVouches && vouchedSpecialties.length > 0 && (
        <View className="mt-3">
          <View className="mb-1.5 flex-row items-center gap-1">
            <MaterialCommunityIcons
              name="heart-outline"
              size={14}
              color={theme.extends.colors.brand}
            />

            <AppText
              weight="medium"
              className="text-[11px] text-text-secondary"
            >
              Vouched for
            </AppText>
          </View>

          <View className="flex-row flex-wrap gap-1">
            {vouchedSpecialties.map((tag) => (
              <SpecialtyTagChip
                key={tag.id}
                tag={{
                  name: tag.name,
                  color: tag.color,
                  icon: tag.icon,
                }}
                size="small"
                showVouchIndicator
                showIcon
              />
            ))}
          </View>
        </View>
      )}

      {/* Engagement actions */}
      {showEngagement && (
        <View className="mt-3 flex-row items-center">
          <Pressable
            onPress={handleLike}
            disabled={!onLike || isLikePending}
            accessibilityRole="button"
            accessibilityLabel={
              isLiked ? "Unlike this review" : "Like this review"
            }
            hitSlop={8}
            className="cursor-pointer flex-row items-center rounded-full py-1 active:opacity-70"
          >
            <Animated.View
              style={{
                transform: [{ scale }],
              }}
            >
              <MaterialCommunityIcons
                name={isLiked ? "thumb-up" : "thumb-up-outline"}
                size={18}
                color={
                  isLiked
                    ? theme.extends.colors.brand
                    : theme.extends.colors.text.secondary
                }
              />
            </Animated.View>

            <AppText
              weight="medium"
              className={`ml-1.5 text-xs ${
                isLiked ? "text-brand" : "text-text-secondary"
              }`}
            >
              {likeCount > 0 ? `${likeCount} helpful` : "Helpful?"}
            </AppText>
          </Pressable>

          {perspective === "explorer" && isLikedByOwner && (
            <View className="ml-4 flex-row items-end">
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

          <View className="flex-1" />

          {onReply && !review.reply && (
            <Pressable
              onPress={onReply}
              accessibilityRole="button"
              accessibilityLabel={`Reply to ${review.author.first_name} ${review.author.last_name}'s review`}
              className="min-h-11 cursor-pointer flex-row items-center justify-center px-2 active:opacity-70"
            >
              <MaterialCommunityIcons
                name="reply-outline"
                size={17}
                color={theme.extends.colors.brand}
              />

              <AppText weight="semibold" className="ml-1 text-xs text-brand">
                Reply
              </AppText>
            </Pressable>
          )}
        </View>
      )}

      {/* Fullscreen photo viewer */}
      <FullScreenPhotoViewer
        photos={review.photos.map((photo) => ({
          uri: photo.photo_url,
        }))}
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

            <View className="ml-2.5 flex-1">
              <AppText
                weight="semibold"
                className="text-sm text-white"
                numberOfLines={1}
              >
                {review.author.first_name} {review.author.last_name}
              </AppText>

              <AppText className="mt-0.5 text-xs text-white/65">
                {relativeDate(review.created_at)}
              </AppText>
            </View>
          </View>
        }
      />
    </>
  );
}
