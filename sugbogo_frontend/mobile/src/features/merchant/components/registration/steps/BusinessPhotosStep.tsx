import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import InfoBanner from "@/shared/components/InfoBanner";
import { useFormContext } from "react-hook-form";

import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";
import PhotoSection from "../business-photos/PhotoSection";
import RegistrationSection from "../RegistrationSection";
import useRegistrationErrorScroll from "@/features/merchant/hooks/registration/useRegistrationErrorScroll";

type OperatingHoursStepProps = {
  registerErrorScrollTarget: ReturnType<
    typeof useRegistrationErrorScroll
  >["registerErrorScrollTarget"];
};
/**
 * Renders the business photos step of merchant registration.
 *
 * Manages photo values through React Hook Form and provides separate
 * sections for storefront, interior, products and services, and additional photos.
 *
 * Storefront photos are required, while the remaining photo categories are optional.
 */
export default function BusinessPhotosStep({
  registerErrorScrollTarget,
}: OperatingHoursStepProps) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<MerchantRegistrationForm>();

  const photos = watch("businessPhotos");

  const storefrontError = errors.businessPhotos?.storefront?.message;

  return (
    <View className="bg-background">
      {/* Shared upload guidance for every photo section */}
      <InfoBanner title="Supported photo formats">
        <AppText className="text-sm leading-5 text-text-secondary">
          Upload JPG, JPEG, or PNG images in any photo section below.
        </AppText>
      </InfoBanner>
      <RegistrationSection
        icon="store-outline"
        title="Storefront Photos"
        description="Add clear photos of your business exterior."
        showBorder={false}
      >
        <View {...registerErrorScrollTarget("businessPhotos.storefront")}>
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
        </View>
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
