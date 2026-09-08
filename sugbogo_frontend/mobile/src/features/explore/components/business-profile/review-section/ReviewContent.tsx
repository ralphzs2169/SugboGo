import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";
import Avatar from "@/shared/components/Avatar";
import FullScreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";

import type { BusinessReview } from "../../../types/review.types";
import { MAX_REVIEW_PHOTOS } from "@/shared/constants/media.constants";

type Props = {
  review: BusinessReview;
  onLike?: () => void;
  isLikePending?: boolean;
  onActions?: () => void;
  onReply?: () => void;
  perspective?: "explorer" | "merchant";
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
 * Renders the shared content of a business review, including reviewer
 * identity, review text, photos, specialty vouches, engagement, and actions.
 *
 * Review photos open in a fullscreen swipeable gallery, while like, reply,
 * and review-action interactions can be connected to the owning card.
 */
export default function ReviewContent({
  review,
  onLike,
  isLikePending = false,
  onActions,
  onReply,
  perspective = "explorer",
}: Props) {
  const [isPhotoViewerVisible, setIsPhotoViewerVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  const scale = useRef(new Animated.Value(1)).current;

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
        <Avatar imageUrl={review.author.avatar_url} size={40} />

        <View className="ml-3 flex-1">
          <View className="flex-row items-center">
            <Text
              className="flex-shrink font-semibold text-text-primary"
              numberOfLines={1}
            >
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
        <Text
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
        </Text>

        {isTruncated && (
          <Pressable
            onPress={() => setIsExpanded((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded ? "Show less of review" : "Read full review"
            }
            className="mt-1 cursor-pointer self-start active:opacity-70"
          >
            <Text className="text-sm font-semibold text-brand">
              {isExpanded ? "Show less" : "Read more"}
            </Text>
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
                    <Text className="text-lg font-bold text-white">
                      +{review.photos.length - MAX_REVIEW_PHOTOS}
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
              name="heart"
              size={16}
              color={theme.extends.colors.brand}
            />

            <Text className="ml-1.5 text-xs font-semibold text-text-secondary">
              Vouched for
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-0.5">
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

      {/* Review engagement and merchant reply */}
      <View className="mt-4 flex-row items-center justify-between">
        {/* Like button */}
        <Pressable
          onPress={handleLike}
          disabled={!onLike || isLikePending}
          accessibilityRole="button"
          accessibilityLabel={
            review.is_liked ? "Unlike this review" : "Like this review"
          }
          className="flex-row cursor-pointer items-center active:opacity-70"
        >
          <Animated.View
            style={{
              transform: [{ scale }],
            }}
          >
            <MaterialCommunityIcons
              name={review.is_liked ? "thumb-up" : "thumb-up-outline"}
              size={20}
              color={
                review.is_liked
                  ? theme.extends.colors.brand
                  : theme.extends.colors.text.secondary
              }
            />
          </Animated.View>

          <Text className="ml-1.5 text-xs font-medium text-text-secondary">
            {review.like_count} found this helpful
          </Text>
        </Pressable>

        {/* Liked by merchant */}
        {perspective === "explorer" && review.is_liked_by_owner && (
          <View className="ml-4 flex-row items-center">
            <MaterialCommunityIcons
              name="heart"
              size={15}
              color={theme.extends.colors.brand}
            />

            <Text className="ml-1 text-xs font-medium text-text-secondary">
              Liked by merchant
            </Text>
          </View>
        )}

        {/* Reply button */}
        {onReply && !review.reply && (
          <Pressable
            onPress={onReply}
            accessibilityRole="button"
            accessibilityLabel={`Reply to ${review.author.first_name} ${review.author.last_name}'s review`}
            className="min-h-11 cursor-pointer justify-center rounded-full bg-brand px-4 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-white">Reply</Text>
          </Pressable>
        )}
      </View>

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
    </>
  );
}
