import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFormContext } from "react-hook-form";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import ReviewSection from "../ReviewSection";
import PhotoPreview from "../../business-photos/PhotoPreview";

type ReviewBusinessPhotosProps = {
  onEdit?: () => void;
};

type PhotoList = MerchantRegistrationForm["businessPhotos"]["storefront"];

export default function ReviewBusinessPhotos({
  onEdit,
}: ReviewBusinessPhotosProps) {
  const { watch } = useFormContext<MerchantRegistrationForm>();
  const photos = watch("businessPhotos");

  const [previewUri, setPreviewUri] = useState<string | null>(null);

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
        {groups.map((group) => (
          <PhotoGroup
            key={group.title}
            title={group.title}
            photos={group.photos}
            onPhotoPress={setPreviewUri}
          />
        ))}
      </ReviewSection>

      <Modal
        visible={previewUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUri(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/80"
          onPress={() => setPreviewUri(null)}
        >
          <Pressable onPress={(event) => event.stopPropagation()}>
            {previewUri && (
              <Image
                source={{ uri: previewUri }}
                className="h-[80vh] w-[90vw]"
                resizeMode="contain"
              />
            )}
          </Pressable>

          <Pressable
            onPress={() => setPreviewUri(null)}
            hitSlop={10}
            className="absolute right-5 top-12 h-10 w-10 items-center justify-center"
          >
            <MaterialCommunityIcons name="close" size={28} color="white" />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

type PhotoGroupProps = {
  title: string;
  photos: PhotoList;
  onPhotoPress: (uri: string) => void;
};

function PhotoGroup({ title, photos, onPhotoPress }: PhotoGroupProps) {
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
              <Pressable
                key={`${photo.uri}-${index}`}
                onPress={() => onPhotoPress(photo.uri)}
                className="rounded-lg opacity-100 pressed:opacity-70"
              >
                <PhotoPreview uri={photo.uri} />
              </Pressable>
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
