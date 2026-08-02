import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import PhotoPreview from "./PhotoPreview";
import { pickBusinessPhotos } from "./PhotoPicker";
import type { BusinessPhoto } from "@/features/merchant/types/merchantRegistration.types";
import { theme } from "@/constants/theme";

type PhotoGridProps = {
  photos: BusinessPhoto[];
  maxPhotos: number;
  required?: boolean;
  onPhotosChange: (photos: BusinessPhoto[]) => void;
};

/**
 * Displays a grid of business photos with controls for adding and removing photos.
 *
 * Handles photo selection through the business photo picker, enforces the
 * maximum photo limit, and shows the current photo count and requirement status.
 */
export default function PhotoGrid({
  photos,
  maxPhotos,
  required = false,
  onPhotosChange,
}: PhotoGridProps) {
  const canAddMore = photos.length < maxPhotos;

  const [isPicking, setIsPicking] = useState(false);

  const handleAddPhoto = async () => {
    if (!canAddMore || isPicking) {
      return;
    }

    setIsPicking(true);

    try {
      const selectedPhotos = await pickBusinessPhotos({
        currentCount: photos.length,
        maxPhotos,
      });

      if (selectedPhotos.length === 0) {
        return;
      }

      onPhotosChange([...photos, ...selectedPhotos]);
    } finally {
      setIsPicking(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, photoIndex) => photoIndex !== index));
  };

  return (
    <View>
      <View className="flex-row flex-wrap">
        {photos.map((photo, index) => (
          <PhotoPreview
            key={`${photo.uri}-${index}`}
            uri={photo.uri}
            onRemove={() => handleRemovePhoto(index)}
          />
        ))}

        {canAddMore && (
          <Pressable
            onPress={handleAddPhoto}
            disabled={isPicking}
            className="h-24 w-24 items-center justify-center rounded-xl border border-dashed border-border-secondary "
          >
            {isPicking ? (
              <ActivityIndicator color={theme.extends.colors.brand} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="plus"
                  size={24}
                  color={theme.extends.colors.text.primary}
                />

                <Text className="mt-1 text-xs font-medium text-text-secondary">
                  Add Photo
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <Text className="mt-3 text-xs text-text-secondary">
        {required ? "Required" : "Optional"} · {required ? "1–" : "Up to "}
        {maxPhotos} photos · {photos.length} added
      </Text>
    </View>
  );
}
