import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";

import { pickBusinessPhotos } from "@/features/merchant/components/registration/business-photos/PhotoPicker";
import PhotoPreview from "@/features/merchant/components/registration/business-photos/PhotoPreview";
import Button from "@/shared/components/Button";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { theme } from "@/constants/theme";

import {
  useCreateReviewReply,
  useUpdateReviewReply,
} from "@/features/explore/hooks/useBusinessReviews";
import type {
  BusinessReview,
  LocalReviewPhoto,
  ReviewPhoto,
} from "@/features/explore/types/review.types";

type Props = {
  businessId: number;
  review: BusinessReview | null;
  sheetRef: React.RefObject<BottomSheetModal | null>;
  onDismiss: () => void;
};

const MAX_PHOTOS = 3;

/**
 * Creates and updates the merchant's single reply to a customer review.
 *
 * The sheet follows the existing review composer interaction, including
 * photo selection and a disabled save action until an edit has changed.
 */
export default function MerchantReviewReplyComposerSheet({
  businessId,
  review,
  sheetRef,
  onDismiss,
}: Props) {
  const { mutateAsync: createReply, isPending: isCreatePending } =
    useCreateReviewReply(businessId);

  const { mutateAsync: updateReply, isPending: isUpdatePending } =
    useUpdateReviewReply(businessId);

  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<LocalReviewPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ReviewPhoto[]>([]);
  const [originalText, setOriginalText] = useState("");
  const [originalPhotoIds, setOriginalPhotoIds] = useState<number[]>([]);
  const [isPicking, setIsPicking] = useState(false);

  const isEditing = Boolean(review?.reply);
  const isPending = isCreatePending || isUpdatePending;
  const photoCount = photos.length + existingPhotos.length;
  const canAddMore = photoCount < MAX_PHOTOS;

  useEffect(() => {
    const reply = review?.reply;
    const initialText = reply?.text ?? "";
    const initialPhotos = reply?.photos ?? [];

    setText(initialText);
    setPhotos([]);
    setExistingPhotos(initialPhotos);
    setOriginalText(initialText);
    setOriginalPhotoIds(initialPhotos.map((photo) => photo.id));
  }, [review]);

  const addPhotos = async () => {
    if (!canAddMore || isPicking) {
      return;
    }

    setIsPicking(true);

    try {
      const selectedPhotos = await pickBusinessPhotos({
        currentCount: photoCount,
        maxPhotos: MAX_PHOTOS,
      });

      if (selectedPhotos.length === 0) {
        return;
      }

      setPhotos((current) => current.concat(selectedPhotos));
    } finally {
      setIsPicking(false);
    }
  };

  const removeExistingPhoto = (photoId: number) => {
    setExistingPhotos((current) =>
      current.filter((photo) => photo.id !== photoId),
    );
  };

  const removeNewPhoto = (index: number) => {
    setPhotos((current) =>
      current.filter((_, photoIndex) => photoIndex !== index),
    );
  };

  const hasChanges = () => {
    if (!isEditing) {
      return true;
    }

    const textChanged = text.trim() !== originalText.trim();

    const existingPhotosChanged =
      existingPhotos.length !== originalPhotoIds.length ||
      existingPhotos.some((photo) => !originalPhotoIds.includes(photo.id));

    return textChanged || existingPhotosChanged || photos.length > 0;
  };

  const canSubmit = Boolean(text.trim()) && (!isEditing || hasChanges());

  const submit = async () => {
    if (!review || !canSubmit || isPending) {
      return;
    }

    try {
      if (review.reply) {
        await updateReply({
          replyId: review.reply.id,
          text: text.trim(),
          photos,
          keepPhotoIds: existingPhotos.map((photo) => photo.id),
        });
      } else {
        await createReply({
          reviewId: review.id,
          text: text.trim(),
          photos,
        });
      }

      Toast.show({
        type: "success",
        text1: review.reply ? "Reply updated" : "Reply sent",
      });

      sheetRef.current?.dismiss();
    } catch (error) {
      const response = error as unknown as ApiResponse<unknown>;

      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: review.reply ? "Unable to update reply" : "Unable to send reply",
          text2: response.message || "Please try again.",
        });
      }
    }
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["80%"]}
      enableDynamicSizing={false}
      enablePanDownToClose={!isPending}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onDismiss={onDismiss}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.45}
        />
      )}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-5 pb-32 pt-3"
      >
        <Text className="text-xl font-bold text-text-primary">
          {isEditing ? "Edit reply" : "Reply to review"}
        </Text>

        <Text className="mt-2 text-xs leading-5 text-text-secondary">
          Your reply will be visible publicly on this review.
        </Text>

        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          placeholder="Write a helpful response"
          editable={!isPending}
          textAlignVertical="top"
          className="mt-4 min-h-32 rounded-card border border-border-primary bg-surface p-3 text-text-primary"
        />

        <View className="mt-5">
          <Text className="mb-3 text-sm font-semibold text-text-primary">
            Photos
          </Text>

          <View className="flex-row flex-wrap">
            {existingPhotos.map((photo) => (
              <PhotoPreview
                key={photo.id}
                uri={photo.photo_url}
                onRemove={
                  isPending ? undefined : () => removeExistingPhoto(photo.id)
                }
              />
            ))}

            {photos.map((photo, index) => (
              <PhotoPreview
                key={`${photo.uri}-${index}`}
                uri={photo.uri}
                onRemove={
                  isPending ? undefined : () => removeNewPhoto(index)
                }
              />
            ))}

            {canAddMore && (
              <Pressable
                onPress={addPhotos}
                disabled={isPicking || isPending}
                accessibilityRole="button"
                accessibilityLabel="Add reply photo"
                className="h-24 w-24 items-center justify-center rounded-xl border border-dashed border-border-secondary active:opacity-70"
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
                      Add photo
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          <Text className="mt-3 text-xs text-text-secondary">
            Optional · Up to {MAX_PHOTOS} photos · {photoCount} added
          </Text>
        </View>

        <Button
          title={isEditing ? "Save changes" : "Send reply"}
          onPress={submit}
          loading={isPending}
          disabled={!canSubmit}
          className="mt-6"
          fontClassName="text-sm font-bold"
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
