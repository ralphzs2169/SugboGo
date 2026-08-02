import { useFormContext } from "react-hook-form";
import { ScrollView, Text, View } from "react-native";

import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import ReviewSection from "../ReviewSection";
import PhotoPreview from "../../business-photos/PhotoPreview";

export default function ReviewBusinessPhotos() {
  const { watch } = useFormContext<MerchantRegistrationForm>();

  const photos = watch("businessPhotos");

  return (
    <ReviewSection icon="image-outline" title="Business Photos">
      <PhotoGroup title="Storefront" photos={photos.storefront} required />

      {photos.interior.length > 0 && (
        <PhotoGroup title="Interior" photos={photos.interior} />
      )}

      {photos.products.length > 0 && (
        <PhotoGroup title="Products" photos={photos.products} />
      )}

      {photos.additional.length > 0 && (
        <PhotoGroup title="Additional" photos={photos.additional} />
      )}
    </ReviewSection>
  );
}

type PhotoGroupProps = {
  title: string;
  photos: MerchantRegistrationForm["businessPhotos"]["storefront"];
  required?: boolean;
};

function PhotoGroup({ title, photos, required = false }: PhotoGroupProps) {
  return (
    <View className="mb-4 last:mb-0">
      <View className="mb-2 flex-row items-center">
        <Text className="text-sm font-semibold text-text-primary">{title}</Text>

        {required && (
          <Text className="ml-1 text-sm font-semibold text-text-error">*</Text>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 4 }}
      >
        {photos.map((photo, index) => (
          <PhotoPreview key={`${photo.uri}-${index}`} uri={photo.uri} />
        ))}
      </ScrollView>
    </View>
  );
}
