import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";

import Button from "@/shared/components/Button";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { pickBusinessPhotos } from "@/features/merchant/components/registration/business-photos/PhotoPicker";
import { theme } from "@/constants/theme";

import {
  useCreateReview,
  useUpdateReview,
} from "../../hooks/useBusinessReviews";
import type {
  BusinessReview,
  LocalReviewPhoto,
  ReviewPhoto,
} from "../../types/review.types";
import PhotoPreview from "@/features/merchant/components/registration/business-photos/PhotoPreview";

type Props = {
  businessId: number;
  sheetRef: React.RefObject<BottomSheetModal | null>;
  review?: BusinessReview | null;
};

const MAX_PHOTOS = 3;

/**
 * Provides a keyboard-friendly bottom sheet for creating or editing a review.
 *
 * Supports review text and up to three photos while reusing the application's
 * standard photo preview and selection interaction. Edit mode disables saving
 * until the review content or attached photos have changed.
 */
export default function ReviewComposerSheet({
  businessId,
  sheetRef,
  review,
}: Props) {
  const { mutateAsync: createReview, isPending: isCreatePending } =
    useCreateReview(businessId);

  const { mutateAsync: updateReview, isPending: isUpdatePending } =
    useUpdateReview(businessId);

  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<LocalReviewPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ReviewPhoto[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [originalText, setOriginalText] = useState("");
  const [originalPhotoIds, setOriginalPhotoIds] = useState<number[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const isEditing = Boolean(review);
  const isPending = isCreatePending || isUpdatePending;
  const photoCount = photos.length + existingPhotos.length;
  const canAddMore = photoCount < MAX_PHOTOS;

  useEffect(() => {
    if (!isSheetOpen) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        sheetRef.current?.dismiss();
        return true;
      },
    );

    return () => subscription.remove();
  }, [isSheetOpen, sheetRef]);

  const resetForm = () => {
    setText(review?.text ?? "");
    setPhotos([]);
    setExistingPhotos(review?.photos ?? []);
  };

  useEffect(() => {
    const initialText = review?.text ?? "";
    const initialPhotoIds = review?.photos.map((photo) => photo.id) ?? [];

    setText(initialText);
    setPhotos([]);
    setExistingPhotos(review?.photos ?? []);
    setOriginalText(initialText);
    setOriginalPhotoIds(initialPhotoIds);
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

  const removePhoto = (index: number) => {
    setPhotos((current) =>
      current.filter((_, photoIndex) => photoIndex !== index),
    );
  };

  const hasReviewChanges = () => {
    if (!isEditing) {
      return true;
    }

    const textChanged = text.trim() !== originalText.trim();

    const photoIdsChanged =
      existingPhotos.length !== originalPhotoIds.length ||
      existingPhotos.some((photo) => !originalPhotoIds.includes(photo.id));

    const newPhotosAdded = photos.length > 0;

    return textChanged || photoIdsChanged || newPhotosAdded;
  };

  const canSubmit = Boolean(text.trim()) && (!isEditing || hasReviewChanges());

  const submit = async () => {
    try {
      if (review) {
        await updateReview({
          reviewId: review.id,
          text: text.trim(),
          photos,
          keepPhotoIds: existingPhotos.map((photo) => photo.id),
        });
      } else {
        await createReview({
          text: text.trim(),
          photos,
        });
      }

      Toast.show({
        type: "info",
        text1: review ? "Review updated" : "Review added",
      });

      setText("");
      setPhotos([]);
      sheetRef.current?.dismiss();
    } catch (error) {
      const response = error as ApiResponse<unknown>;

      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: review ? "Unable to update review" : "Unable to add review",
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
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onChange={(index) => {
        const isOpen = index >= 0;

        setIsSheetOpen(isOpen);

        if (!isOpen) {
          resetForm();
        }
      }}
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
        {/* Review content */}
        <Text className="text-xl font-bold text-text-primary">
          {isEditing ? "Edit review" : "Write a review"}
        </Text>

        {/* Informational note */}
        <View className="mt-2 flex-row items-center">
          <MaterialCommunityIcons
            name="information-outline"
            size={14}
            color={theme.extends.colors.text.secondary}
          />

          <Text className="ml-1 text-xs text-text-secondary">
            You can submit one review per business.
          </Text>
        </View>

        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          placeholder="Share your experience"
          className="mt-4 min-h-32 rounded-card border border-border-primary bg-surface p-3 text-text-primary"
          textAlignVertical="top"
        />

        {/* Photo selection */}
        <View className="mt-5">
          <Text className="mb-3 text-sm font-semibold text-text-primary">
            Photos
          </Text>

          <View className="flex-row flex-wrap">
            {existingPhotos.map((photo) => (
              <View key={photo.id} className="mr-3">
                <PhotoPreview
                  uri={photo.photo_url}
                  onRemove={() => removeExistingPhoto(photo.id)}
                />
              </View>
            ))}

            {photos.map((photo, index) => (
              <View key={`${photo.uri}-${index}`} className="mr-3">
                <PhotoPreview
                  uri={photo.uri}
                  onRemove={() => removePhoto(index)}
                />
              </View>
            ))}

            {canAddMore && (
              <Pressable
                onPress={addPhotos}
                disabled={isPicking}
                className="h-24 w-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border-secondary active:opacity-70"
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
                      Add Photo
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

        {/* Submit action */}
        <Button
          title={isEditing ? "Save changes" : "Submit review"}
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
