import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import type { ExploreBusinessPhoto } from "../../types/exploreBusiness.types";

type Props = {
  photos: ExploreBusinessPhoto[];
  onPhotoPress?: (index: number) => void;
};

const PREVIEW_COUNT = 3;

/**
 * Displays a compact visual preview of the business photo gallery.
 *
 * The first photo receives visual emphasis while two supporting photos
 * provide additional context. The final preview shows how many additional
 * photos are available when the gallery contains more than three photos.
 */
export default function BusinessPhotosSection({ photos, onPhotoPress }: Props) {
  if (photos.length === 0) {
    return null;
  }

  const previewPhotos = photos.slice(0, PREVIEW_COUNT);
  const featuredPhoto = previewPhotos[0];
  const supportingPhotos = previewPhotos.slice(1);
  const additionalPhotoCount = photos.length - PREVIEW_COUNT;

  return (
    <View>
      {/* Photo gallery preview */}
      <View className="flex-row gap-2">
        {/* Featured photo */}
        <Pressable
          onPress={() => onPhotoPress?.(0)}
          className="aspect-[4/3] flex-[2] overflow-hidden rounded-card bg-surface-secondary cursor-pointer active:opacity-90"
        >
          <Image
            source={{ uri: featuredPhoto.photo_url }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
          />
        </Pressable>

        {/* Supporting photos */}
        <View className="flex-1 gap-2">
          {supportingPhotos.map((photo, index) => {
            const photoIndex = index + 1;
            const isLastPreview = index === supportingPhotos.length - 1;
            const hasMorePhotos = additionalPhotoCount > 0;

            return (
              <Pressable
                key={photo.id}
                onPress={() => onPhotoPress?.(photoIndex)}
                className="min-h-0 flex-1 overflow-hidden rounded-card bg-surface-secondary cursor-pointer active:opacity-90"
              >
                <Image
                  source={{ uri: photo.photo_url }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  transition={150}
                />

                {/* More photos overlay */}
                {isLastPreview && hasMorePhotos && (
                  <View className="absolute inset-0 items-center justify-center bg-black/45">
                    <Text className="text-xl font-bold text-white">
                      +{additionalPhotoCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
