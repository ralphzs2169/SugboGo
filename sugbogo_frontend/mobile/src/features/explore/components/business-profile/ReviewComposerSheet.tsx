import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";

import Button from "@/shared/components/Button";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { pickBusinessPhotos } from "@/features/merchant/components/registration/business-photos/PhotoPicker";
import { useCreateReview, useUpdateReview } from "../../hooks/useBusinessReviews";
import type { BusinessReview, LocalReviewPhoto, ReviewPhoto } from "../../types/review.types";

type Props = {
  businessId: number;
  sheetRef: React.RefObject<BottomSheetModal | null>;
  review?: BusinessReview | null;
};

/** Provides a keyboard-friendly bottom sheet for creating a review with up to three photos. */
export default function ReviewComposerSheet({ businessId, sheetRef, review }: Props) {
  const { mutateAsync: createReview, isPending: isCreatePending } = useCreateReview(businessId);
  const { mutateAsync: updateReview, isPending: isUpdatePending } = useUpdateReview(businessId);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<LocalReviewPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ReviewPhoto[]>([]);
  const isEditing = Boolean(review);
  const isPending = isCreatePending || isUpdatePending;
  useEffect(() => { setText(review?.text ?? ""); setPhotos([]); setExistingPhotos(review?.photos ?? []); }, [review]);
  const addPhotos = async () => {
    const selectedPhotos = await pickBusinessPhotos({
      currentCount: photos.length + existingPhotos.length,
      maxPhotos: 3,
    });

    setPhotos((current) => current.concat(selectedPhotos));
  };
  const submit = async () => {
    try {
      if (review) {
        await updateReview({ reviewId: review.id, text: text.trim(), photos, keepPhotoIds: existingPhotos.map((photo) => photo.id) });
      } else {
        await createReview({ text: text.trim(), photos });
      }
      Toast.show({ type: "info", text1: review ? "Review updated" : "Review added" });
      setText("");
      setPhotos([]);
      sheetRef.current?.dismiss();
    } catch (error) {
      const response = error as ApiResponse<unknown>;
      if (!response.success && !handleSystemError(response))
        Toast.show({
          type: "error",
          text1: review ? "Unable to update review" : "Unable to add review",
          text2: response.message || "Please try again.",
        });
    }
  };
  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["90%"]}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
    >
      <BottomSheetScrollView contentContainerClassName="px-5 pb-10 pt-3">
        {/* Review content */}
        <Text className="text-xl font-bold text-text-primary">
          {isEditing ? "Edit review" : "Write a review"}
        </Text>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          placeholder="Share your experience"
          className="mt-4 min-h-32 rounded-card border border-border-primary p-3 text-text-primary"
          textAlignVertical="top"
        />
        {/* Photo selection */}
        <View className="mt-4 flex-row gap-2">
          {existingPhotos.map((photo) => <Pressable key={photo.id} onPress={() => setExistingPhotos((current) => current.filter((item) => item.id !== photo.id))} className="h-20 w-20 overflow-hidden rounded-lg"><Image source={{ uri: photo.photo_url }} className="h-full w-full" /><View className="absolute inset-0 items-center justify-center bg-black/40"><Text className="font-bold text-white">×</Text></View></Pressable>)}
          {photos.map((photo, index) => (
            <Pressable
              key={photo.uri}
              onPress={() =>
                setPhotos((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              className="h-20 w-20 overflow-hidden rounded-lg"
            >
              <Image source={{ uri: photo.uri }} className="h-full w-full" />
              <View className="absolute inset-0 items-center justify-center bg-black/40">
                <Text className="font-bold text-white">×</Text>
              </View>
            </Pressable>
          ))}
          {photos.length + existingPhotos.length < 3 && (
            <Pressable
              onPress={addPhotos}
              className="h-20 w-20 items-center justify-center rounded-lg border border-dashed border-brand"
            >
              <Text className="text-brand">Add photo</Text>
            </Pressable>
          )}
        </View>
        <Button
          title={isEditing ? "Save changes" : "Submit review"}
          onPress={submit}
          loading={isPending}
          disabled={!text.trim()}
          className="mt-6"
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
