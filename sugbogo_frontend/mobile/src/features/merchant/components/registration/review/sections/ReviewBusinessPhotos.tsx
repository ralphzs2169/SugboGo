import { ScrollView, Text, View } from "react-native";
import type { z } from "zod";

import { merchantRegistrationSchema } from "@/features/merchant/validation/merchantRegistration.schema";
import ReviewSection from "../ReviewSection";
import PhotoPreview from "../../business-photos/PhotoPreview";
import { ApplicationFeedbackResponse } from "@/features/merchant/types/registration/registrationApi.types";
import ReviewSectionFeedback from "../ReviewSectionFeedback";

type ReviewForm = z.input<typeof merchantRegistrationSchema>;
type ReviewBusinessPhotosProps = {
  form: ReviewForm;
  onEdit?: () => void;
  feedback?: ApplicationFeedbackResponse;
};

type PhotoList = ReviewForm["businessPhotos"]["storefront"];

export default function ReviewBusinessPhotos({
  form,
  onEdit,
  feedback,
}: ReviewBusinessPhotosProps) {
  const photos = form.businessPhotos;

  const groups = [
    { title: "Storefront", photos: photos.storefront, required: true },
    { title: "Interior", photos: photos.interior },
    { title: "Products", photos: photos.products },
    { title: "Additional", photos: photos.additional },
  ].filter((group) => group.required || group.photos.length > 0);

  return (
    <>
      <ReviewSection
        icon="image-outline"
        title="Business Photos"
        onEdit={onEdit}
      >
        <ReviewSectionFeedback feedback={feedback} />
        {groups.map((group) => (
          <PhotoGroup
            key={group.title}
            title={group.title}
            photos={group.photos}
          />
        ))}
      </ReviewSection>
    </>
  );
}

type PhotoGroupProps = {
  title: string;
  photos: PhotoList;
};

function PhotoGroup({ title, photos }: PhotoGroupProps) {
  return (
    <View className="mb-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-text-primary">{title}</Text>

        {photos.length > 0 && (
          <Text className="text-xs text-text-secondary">
            {photos.length} {photos.length === 1 ? "photo" : "photos"}
          </Text>
        )}
      </View>

      <View className="mt-1 border-t border-border-primary" />

      <View className="mt-3">
        {photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 4, gap: 8 }}
          >
            {photos.map((photo, index) => (
              <PhotoPreview key={`${photo.uri}-${index}`} uri={photo.uri} />
            ))}
          </ScrollView>
        ) : (
          <View className="items-center justify-center rounded-lg border border-dashed border-border-primary py-4">
            <Text className="text-sm text-text-secondary">No photos added</Text>
          </View>
        )}
      </View>
    </View>
  );
}
