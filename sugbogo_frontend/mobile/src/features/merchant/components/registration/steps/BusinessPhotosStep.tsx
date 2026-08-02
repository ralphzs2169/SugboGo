import { View } from "react-native";
import { useFormContext } from "react-hook-form";

import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";
import PhotoSection from "../business-photos/PhotoSection";
import RegistrationSection from "../RegistrationSection";

/**
 * Renders the business photos step of merchant registration.
 *
 * Manages photo values through React Hook Form and provides separate
 * sections for storefront, interior, products and services, and additional photos.
 *
 * Storefront photos are required, while the remaining photo categories are optional.
 */
export default function BusinessPhotosStep() {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<MerchantRegistrationForm>();

  const photos = watch("businessPhotos");

  const storefrontError = errors.businessPhotos?.storefront?.message;

  return (
    <View className="bg-background">
      <RegistrationSection
        icon="store-outline"
        title="Storefront Photos"
        description="Add clear photos of your business exterior."
        showBorder={false}
      >
        <PhotoSection
          photos={photos.storefront}
          maxPhotos={3}
          required
          error={storefrontError}
          onPhotosChange={(value) =>
            setValue("businessPhotos.storefront", value, {
              shouldDirty: true,
              shouldValidate: !!errors.businessPhotos?.storefront,
            })
          }
        />
      </RegistrationSection>

      <RegistrationSection
        icon="image-outline"
        title="Interior Photos"
        description="Show your space, seating, atmosphere, or setup."
        showBorder={false}
      >
        <PhotoSection
          photos={photos.interior}
          maxPhotos={5}
          onPhotosChange={(value) =>
            setValue("businessPhotos.interior", value, {
              shouldDirty: true,
            })
          }
        />
      </RegistrationSection>

      <RegistrationSection
        icon="food-outline"
        title="Products & Services"
        description="Add photos that showcase your products or services."
        showBorder={false}
      >
        <PhotoSection
          photos={photos.products}
          maxPhotos={5}
          onPhotosChange={(value) =>
            setValue("businessPhotos.products", value, {
              shouldDirty: true,
            })
          }
        />
      </RegistrationSection>

      <RegistrationSection
        icon="image-multiple-outline"
        title="Additional Photos"
        description="Add any other photos that represent your business."
        showBorder={false}
      >
        <PhotoSection
          photos={photos.additional}
          maxPhotos={5}
          onPhotosChange={(value) =>
            setValue("businessPhotos.additional", value, {
              shouldDirty: true,
            })
          }
        />
      </RegistrationSection>
    </View>
  );
}
