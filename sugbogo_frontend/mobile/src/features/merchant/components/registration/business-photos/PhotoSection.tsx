import { View } from "react-native";
import AppText from "@/shared/components/AppText";

import PhotoGrid from "./PhotoGrid";
import type { BusinessPhoto } from "@/features/merchant/types/registration/registrationOption.types";
import { useFormContext } from "react-hook-form";

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
  const {
    formState: { disabled },
  } = useFormContext();
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
          disabled={disabled}
        />
        {error && (
          <AppText className="mt-2 text-sm text-text-error">{error}</AppText>
        )}
      </View>
    </View>
  );
}
