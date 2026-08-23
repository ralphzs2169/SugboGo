import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import type { ExploreBusinessPhoto } from "../../types/exploreBusiness.types";

type Props = {
  photos: ExploreBusinessPhoto[];
  onViewAll?: () => void;
};

const PREVIEW_COUNT = 3;

/**
 * Displays a compact preview of the business photo gallery.
 *
 * The profile shows only a small set of photos to keep the page focused,
 * while a separate action can open the complete gallery when available.
 */
export default function BusinessPhotosSection({ photos, onViewAll }: Props) {
  if (photos.length === 0) {
    return null;
  }

  const previewPhotos = photos.slice(0, PREVIEW_COUNT);
  const hasMorePhotos = photos.length > PREVIEW_COUNT;

  return (
    <View className="mt-6 border-t border-border-primary px-4 pt-5">
      {/* Section heading */}
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-text-primary">Photos</Text>

        {hasMorePhotos && (
          <Pressable onPress={onViewAll} className="active:opacity-70">
            <Text className="text-sm font-semibold text-brand">View all</Text>
          </Pressable>
        )}
      </View>

      {/* Photo previews */}
      <View className="mt-3 flex-row gap-2">
        {previewPhotos.map((photo) => (
          <Pressable
            key={photo.id}
            onPress={onViewAll}
            className="aspect-square flex-1 overflow-hidden rounded-card bg-surface-secondary active:opacity-90"
          >
            <Image
              source={{ uri: photo.photo_url }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={150}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
