import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import { Animated, Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import { MAX_REVIEW_PHOTOS } from "@/shared/constants/media.constants";
import AppText from "@/shared/components/AppText";
import Avatar from "@/shared/components/Avatar";
import FullScreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";

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
};

const MAX_REVIEW_LINES = 5;

function relativeDate(value: string) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
  );

  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

/**
 * Renders the shared visual content of a business review.
 *
 * Supports reduced review snapshots by keeping engagement and specialty
 * metadata optional, while interactive review features can be hidden when
 * the component is used in read-only contexts such as dispute history.
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
}: Props) {
  const [isPhotoViewerVisible, setIsPhotoViewerVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  const scale = useRef(new Animated.Value(1)).current;

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

    onLike();
  };

  return (
    <>
      {/* Reviewer identity and actions */}
      <View className="flex-row items-center">
        <Avatar
          imageUrl={review.author.avatar_url}
          avatarKey={review.author.avatar_key}
          size={40}
        />

        <View className="ml-3 flex-1">
          <View className="flex-row items-center">
            <AppText
              weight="semibold"
              className="flex-shrink text-text-primary"
              numberOfLines={1}
            >
              {review.author.first_name} {review.author.last_name}
            </AppText>

            {review.is_own_review && (
              <View className="ml-2 rounded-full bg-brand/10 px-2 py-0.5">
                <AppText weight="semibold" className="text-[10px] text-brand">
                  Your review
                </AppText>
              </View>
            )}
          </View>

          <AppText className="mt-0.5 text-xs text-text-secondary">
            {relativeDate(review.created_at)}
          </AppText>
        </View>

        {onActions && (
          <Pressable
            onPress={onActions}
            accessibilityRole="button"
            accessibilityLabel="Review actions"
            className="ml-2 cursor-pointer p-1 active:opacity-70"
          >
            <MaterialCommunityIcons
              name="dots-vertical"
              size={20}
              color={theme.extends.colors.text.tertiary}
            />
          </Pressable>
        )}
      </View>

      {/* Review text */}
      <View className="mt-4">
        <AppText
          className="text-sm leading-6 text-text-primary"
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
            className="mt-1 cursor-pointer self-start active:opacity-70"
          >
            <AppText weight="semibold" className="text-sm text-brand">
              {isExpanded ? "Show less" : "Read more"}
            </AppText>
          </Pressable>
        )}
      </View>

      {/* Review photos */}
      {review.photos.length > 0 && (
        <View className="mt-4 flex-row flex-wrap gap-2">
          {review.photos.slice(0, MAX_REVIEW_PHOTOS).map((photo, index) => (
            <Pressable
              key={photo.id}
              onPress={() => handlePhotoPress(index)}
              accessibilityRole="button"
              accessibilityLabel={`View review photo ${index + 1}`}
              className="aspect-square w-[31%] cursor-pointer overflow-hidden rounded-xl bg-surface-secondary active:opacity-90"
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
                    <AppText weight="bold" className="text-lg text-white">
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
        <View className="mt-4">
          <View className="mb-2 flex-row items-center">
            <MaterialCommunityIcons
              name="heart-outline"
              size={16}
              color={theme.extends.colors.brand}
            />

            <AppText
              weight="semibold"
              className="ml-1.5 text-xs text-text-secondary"
            >
              Vouched for
            </AppText>
          </View>

          <View className="flex-row flex-wrap gap-0.5">
            {vouchedSpecialties.map((tag) => (
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

      {/* Review engagement and merchant reply */}
      {showEngagement && (
        <View className="mt-4 flex-row items-center justify-between">
          {/* Like action */}
          <Pressable
            onPress={handleLike}
            disabled={!onLike || isLikePending}
            accessibilityRole="button"
            accessibilityLabel={
              isLiked ? "Unlike this review" : "Like this review"
            }
            className="flex-row cursor-pointer items-center active:opacity-70"
          >
            <Animated.View
              style={{
                transform: [{ scale }],
              }}
            >
              <MaterialCommunityIcons
                name={isLiked ? "thumb-up" : "thumb-up-outline"}
                size={20}
                color={
                  isLiked
                    ? theme.extends.colors.brand
                    : theme.extends.colors.text.secondary
                }
              />
            </Animated.View>

            <AppText
              weight="medium"
              className="ml-1.5 text-xs text-text-secondary"
            >
              {likeCount} found this helpful
            </AppText>
          </Pressable>

          {/* Merchant endorsement */}
          {perspective === "explorer" && isLikedByOwner && (
            <View className="ml-4 flex-row items-center">
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

          {/* Merchant reply action */}
          {onReply && !review.reply && (
            <Pressable
              onPress={onReply}
              accessibilityRole="button"
              accessibilityLabel={`Reply to ${review.author.first_name} ${review.author.last_name}'s review`}
              className="min-h-11 cursor-pointer justify-center rounded-full bg-brand px-4 active:opacity-80"
            >
              <AppText weight="semibold" className="text-sm text-white">
                Reply
              </AppText>
            </Pressable>
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
