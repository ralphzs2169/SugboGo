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

import type { CommunityReview } from "../types/communityReview.types";

type Props = {
  photos: CommunityReview["photos"];
  onPhotoPress: (index: number) => void;
};

/** Portrait 4:5 keeps feed photos tall without dominating the screen. Use 1 for square. */
const MEDIA_ASPECT_RATIO = 16 / 10;

/**
 * Full-bleed, swipeable review photo carousel for the Community feed.
 *
 * A single photo renders as one edge-to-edge image. Multiple photos page
 * horizontally with a counter badge and pagination dots, like a social feed.
 */
export default function ReviewPhotoCarousel({ photos, onPhotoPress }: Props) {
  const { width } = useWindowDimensions();
  const height = Math.round(width / MEDIA_ASPECT_RATIO);

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
            <Pressable
              onPress={() => onPhotoPress(index)}
              accessibilityRole="button"
              accessibilityLabel={`View review photo ${index + 1} of ${photos.length}`}
              style={{ width, height }}
            >
              <Image
                source={{ uri: item.photo_url }}
                style={{ width, height }}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
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
