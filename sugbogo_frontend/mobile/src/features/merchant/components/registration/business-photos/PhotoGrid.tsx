import { ActivityIndicator, Pressable, View } from "react-native";
import AppText from "@/shared/components/AppText";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLayoutEffect, useRef, useState } from "react";
import Toast from "react-native-toast-message";
import PhotoPreview from "./PhotoPreview";
import { pickBusinessPhotos } from "./PhotoPicker";
import type { BusinessPhoto } from "@/features/merchant/types/registration/registrationOption.types";
import { theme } from "@/constants/theme";

type PhotoGridProps = {
  disabled?: boolean;
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
  disabled = false,
  maxPhotos,
  required = false,
  onPhotosChange,
}: PhotoGridProps) {
  const canAddMore = photos.length < maxPhotos;

  const [isPicking, setIsPicking] = useState(false);
  const disabledRef = useRef(disabled);
  const pickerGeneration = useRef(0);
  useLayoutEffect(() => {
    disabledRef.current = disabled;
    return () => {
      disabledRef.current = true;
      pickerGeneration.current += 1;
    };
  }, [disabled]);

  const handleAddPhoto = async () => {
    if (disabledRef.current || !canAddMore || isPicking) {
      return;
    }

    setIsPicking(true);
    const operation = pickerGeneration.current;

    try {
      const selectedPhotos = await pickBusinessPhotos({
        currentCount: photos.length,
        maxPhotos,
      });

      if (
        disabledRef.current ||
        operation !== pickerGeneration.current ||
        selectedPhotos.length === 0
      ) {
        return;
      }

      onPhotosChange([...photos, ...selectedPhotos]);
    } catch (error) {
      if (!disabledRef.current && operation === pickerGeneration.current) {
        Toast.show({
          type: "error",
          text1: "Unable to add photos",
          text2:
            error instanceof Error
              ? `${error.message} Please try again.`
              : "Please choose the photos again and try again.",
        });
      }
    } finally {
      setIsPicking(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    if (disabledRef.current) return;
    onPhotosChange(photos.filter((_, photoIndex) => photoIndex !== index));
  };

  return (
    <View>
      <View className="flex-row flex-wrap">
        {photos.map((photo, index) => (
          <PhotoPreview
            key={`${photo.uri}-${index}`}
            uri={photo.uri}
            onRemove={disabled ? undefined : () => handleRemovePhoto(index)}
          />
        ))}

        {canAddMore && (
          <Pressable
            onPress={() => void handleAddPhoto()}
            disabled={disabled || isPicking}
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

                <AppText
                  weight="medium"
                  className="mt-1 text-xs text-text-secondary"
                >
                  Add Photo
                </AppText>
              </>
            )}
          </Pressable>
        )}
      </View>

      <AppText className="mt-3 text-xs text-text-secondary">
        {required ? "Required" : "Optional"} · {required ? "1–" : "Up to "}
        {maxPhotos} photos · {photos.length} added
      </AppText>
    </View>
  );
}
