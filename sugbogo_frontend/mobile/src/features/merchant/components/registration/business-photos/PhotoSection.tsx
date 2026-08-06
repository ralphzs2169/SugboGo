import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import PhotoGrid from "./PhotoGrid";
import type { BusinessPhoto } from "@/features/merchant/types/merchantRegistration.types";

type PhotoSectionProps = {
  photos: BusinessPhoto[];
  maxPhotos: number;
  error?: string;
  required?: boolean;
  onPhotosChange: (photos: BusinessPhoto[]) => void;
};

/**
 * Wraps a business photo grid with its validation state.
 *
 * Displays the photo section container, forwards photo changes to the parent,
 * and highlights the section when a validation error is present.
 */
export default function PhotoSection({
  photos,
  maxPhotos,
  error,
  required = false,
  onPhotosChange,
}: PhotoSectionProps) {
  return (
    <View
      className={`mb-4 rounded-md border px-4 py-4 ${
        error ? "border-border-error bg-error" : "border-border-primary"
      }`}
    >
      <View className="mt-4">
        <PhotoGrid
          photos={photos}
          maxPhotos={maxPhotos}
          onPhotosChange={onPhotosChange}
          required={required}
        />
        <View className="mt-2 flex-row items-center">
          <MaterialCommunityIcons
            name="information-outline"
            size={14}
            color="#6B7280"
          />
          <Text className="ml-1 text-xs text-text-secondary">
            Supported: JPG, JPEG, PNG
          </Text>
        </View>
        {error && <Text className="mt-2 text-sm text-text-error">{error}</Text>}
      </View>
    </View>
  );
}
