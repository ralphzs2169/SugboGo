import { Image } from "expo-image";
import { useState } from "react";
import {
  FlatList,
  Pressable,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";

import type { CommunityReview } from "../types/communityReview.types";
import { COMMUNITY_REVIEW_MEDIA_ASPECT_RATIO } from "../constants/communityMedia";

type Props = {
  photos: CommunityReview["photos"];
  onPhotoPress: (index: number) => void;
};

/** Keeps a failed photo's page stable and retries only when requested. */
function ReviewPhoto({
  photo,
  index,
  photoCount,
  width,
  height,
  onPhotoPress,
}: {
  photo: CommunityReview["photos"][number];
  index: number;
  photoCount: number;
  width: number;
  height: number;
  onPhotoPress: (index: number) => void;
}) {
  const [hasFailed, setHasFailed] = useState(false);

  return (
    <View style={{ width, height }}>
      {hasFailed ? (
        <ErrorState
          size="small"
          title="Couldn't load photo"
          description="Please try again."
          primaryActionTitle="Retry"
          primaryActionTextTone="primary"
          onPrimaryAction={() => setHasFailed(false)}
        />
      ) : (
        <Pressable
          onPress={() => onPhotoPress(index)}
          accessibilityRole="button"
          accessibilityLabel={`View review photo ${index + 1} of ${photoCount}`}
          style={{ width, height }}
        >
          <Image
            source={{ uri: photo.photo_url }}
            style={{ width, height }}
            contentFit="cover"
            transition={150}
            onError={() => setHasFailed(true)}
          />
        </Pressable>
      )}
    </View>
  );
}

/**
 * Full-bleed, swipeable review photo carousel for the Community feed.
 *
 * A single photo renders as one edge-to-edge image. Multiple photos page
 * horizontally with a counter badge and pagination dots, like a social feed.
 */
export default function ReviewPhotoCarousel({ photos, onPhotoPress }: Props) {
  const { width } = useWindowDimensions();
  const height = Math.round(width / COMMUNITY_REVIEW_MEDIA_ASPECT_RATIO);

  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultiple = photos.length > 1;

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(Math.min(Math.max(index, 0), photos.length - 1));
  };

  return (
    <View>
      <View style={{ width, height }} className="bg-background">
        <FlatList
          data={photos}
          keyExtractor={(photo) => String(photo.id)}
          horizontal
          pagingEnabled
          bounces={false}
          scrollEnabled={hasMultiple}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          initialNumToRender={1}
          windowSize={3}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onMomentumScrollEnd={handleMomentumEnd}
          renderItem={({ item, index }) => (
            <ReviewPhoto
              key={item.photo_url}
              photo={item}
              index={index}
              photoCount={photos.length}
              width={width}
              height={height}
              onPhotoPress={onPhotoPress}
            />
          )}
        />

        {/* Photo counter */}
        {hasMultiple && (
          <View
            pointerEvents="none"
            className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1"
          >
            <AppText weight="medium" className="text-[11px] text-white">
              {activeIndex + 1}/{photos.length}
            </AppText>
          </View>
        )}
      </View>

      {/* Pagination dots */}
      {hasMultiple && (
        <View
          className="flex-row items-center justify-center gap-1.5 pt-2.5"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {photos.map((photo, index) => (
            <View
              key={photo.id}
              className={`h-1.5 rounded-full ${
                index === activeIndex
                  ? "w-4 bg-brand"
                  : "w-1.5 bg-border-secondary"
              }`}
            />
          ))}
        </View>
      )}
    </View>
  );
}
