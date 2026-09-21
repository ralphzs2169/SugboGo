import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, View } from "react-native";
import Toast from "react-native-toast-message";

import { pickBusinessPhotos } from "@/features/merchant/components/registration/business-photos/PhotoPicker";
import PhotoPreview from "@/features/merchant/components/registration/business-photos/PhotoPreview";
import Button from "@/shared/components/Button";
import AppText from "@/shared/components/AppText";
import FormTextArea from "@/shared/components/form/FormTextArea";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
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
import { MAX_REVIEW_PHOTOS } from "@/shared/constants/media.constants";

type Props = {
  businessId: number;
  sheetRef: React.RefObject<BottomSheetModal | null>;
  review?: BusinessReview | null;
};

type ReviewErrors = {
  text?: string;
};

/**
 * Provides a keyboard-friendly bottom sheet for creating or editing a review.
 *
 * Supports review text and up to three photos while reusing the application's
 * standard form textarea and photo preview components. Validation errors are
 * shown after submission attempts and cleared when the field is focused.
 */
export default function ReviewComposerSheet({
  businessId,
  sheetRef,
  review,
}: Props) {
  const {
    mutateAsync: createReview,
    isPending: isCreatePending,
    error: createError,
  } = useCreateReview(businessId);

  const {
    mutateAsync: updateReview,
    isPending: isUpdatePending,
    error: updateError,
  } = useUpdateReview(businessId);

  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<LocalReviewPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ReviewPhoto[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [originalText, setOriginalText] = useState("");
  const [originalPhotoIds, setOriginalPhotoIds] = useState<number[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [errors, setErrors] = useState<ReviewErrors>({});

  const isEditing = Boolean(review);
  const isPending = isCreatePending || isUpdatePending;

  const photoCount = photos.length + existingPhotos.length;
  const canAddMore = photoCount < MAX_REVIEW_PHOTOS;

  const trimmedText = text.trim();

  const hasReviewChanges = () => {
    if (!isEditing) {
      return true;
    }

    const textChanged = trimmedText !== originalText.trim();

    const existingPhotosChanged =
      existingPhotos.length !== originalPhotoIds.length ||
      existingPhotos.some((photo) => !originalPhotoIds.includes(photo.id));

    const newPhotosAdded = photos.length > 0;

    return textChanged || existingPhotosChanged || newPhotosAdded;
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!isSheetOpen) {
          return false;
        }

        sheetRef.current?.dismiss();
        return true;
      },
    );

    return () => subscription.remove();
  }, [isSheetOpen, sheetRef]);

  const resetForm = () => {
    const initialText = review?.text ?? "";
    const initialPhotos = review?.photos ?? [];

    setText(initialText);
    setPhotos([]);
    setExistingPhotos(initialPhotos);
    setOriginalText(initialText);
    setOriginalPhotoIds(initialPhotos.map((photo) => photo.id));
    setErrors({});
  };

  useEffect(() => {
    resetForm();
  }, [review]);

  useEffect(() => {
    const error = createError || updateError;

    if (!error) {
      return;
    }

    const response = error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: isEditing ? "Unable to update review" : "Unable to add review",
        text2: response.message || "Please try again.",
      });
    }
  }, [createError, updateError, isEditing]);

  const clearFieldError = (field: keyof ReviewErrors) => {
    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));
  };

  const validate = (): ReviewErrors => {
    const validationErrors: ReviewErrors = {};

    if (!trimmedText) {
      validationErrors.text = "Review is required.";
    } else if (trimmedText.length < 25) {
      validationErrors.text = "Review must be at least 25 characters.";
    }

    return validationErrors;
  };

  const addPhotos = async () => {
    if (!canAddMore || isPicking || isPending) {
      return;
    }

    setIsPicking(true);

    try {
      const selectedPhotos = await pickBusinessPhotos({
        currentCount: photoCount,
        maxPhotos: MAX_REVIEW_PHOTOS,
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
    if (isPending) {
      return;
    }

    setExistingPhotos((current) =>
      current.filter((photo) => photo.id !== photoId),
    );
  };

  const removePhoto = (index: number) => {
    if (isPending) {
      return;
    }

    setPhotos((current) =>
      current.filter((_, photoIndex) => photoIndex !== index),
    );
  };

  const canSubmit = !isPending && (!isEditing || hasReviewChanges());

  const submit = async () => {
    if (isPending) {
      return;
    }

    if (!canSubmit) {
      return;
    }

    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      if (review) {
        await updateReview({
          reviewId: review.id,
          text: trimmedText,
          photos,
          keepPhotoIds: existingPhotos.map((photo) => photo.id),
        });
      } else {
        await createReview({
          text: trimmedText,
          photos,
        });
      }

      Toast.show({
        type: "success",
        text1: review ? "Review updated" : "Review added",
      });

      sheetRef.current?.dismiss();
    } catch {
      // API errors are handled through the mutation error state.
    }
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["90%"]}
      enableDynamicSizing={false}
      enablePanDownToClose={!isPending}
      keyboardBehavior="fillParent"
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
        {/* Sheet header */}
        <AppText weight="bold" className="text-xl text-text-primary">
          {isEditing ? "Edit review" : "Write a review"}
        </AppText>

        {/* Informational note */}
        <View className="mt-2 flex-row items-center">
          <MaterialCommunityIcons
            name="information-outline"
            size={14}
            color={theme.extends.colors.text.secondary}
          />

          <AppText className="ml-1 text-xs text-text-secondary">
            You can submit one review per business.
          </AppText>
        </View>

        {/* Review text */}
        <View className="mt-4">
          <FormTextArea
            label="Your review"
            showLabel={false}
            value={text}
            onChangeText={setText}
            onFocus={() => clearFieldError("text")}
            placeholder="Share your experience"
            maxLength={1000}
            showCharacterCount
            minLength={25}
            required
            error={errors.text}
            editable={!isPending}
            InputComponent={BottomSheetTextInput}
          />
        </View>

        {/* Review photos */}
        <View>
          <AppText weight="bold" className="mb-3 text-sm text-text-primary">
            Include Photos (optional)
          </AppText>

          <View className="flex-row flex-wrap">
            {existingPhotos.map((photo) => (
              <View key={photo.id} className="mr-3">
                <PhotoPreview
                  uri={photo.photo_url}
                  onRemove={
                    isPending ? undefined : () => removeExistingPhoto(photo.id)
                  }
                />
              </View>
            ))}

            {photos.map((photo, index) => (
              <View key={`${photo.uri}-${index}`} className="mr-3">
                <PhotoPreview
                  uri={photo.uri}
                  onRemove={isPending ? undefined : () => removePhoto(index)}
                />
              </View>
            ))}

            {canAddMore && (
              <Pressable
                onPress={addPhotos}
                disabled={isPicking || isPending}
                accessibilityRole="button"
                accessibilityLabel="Add review photo"
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

                    <AppText
                      weight="medium"
                      className="mt-1 text-xs text-text-secondary"
                    >
                      Add photo
                    </AppText>
                  </>
                )}
              </Pressable>
            )}
          </View>

          <AppText className="mt-3 text-xs text-text-secondary">
            Optional · Up to {MAX_REVIEW_PHOTOS} photos · {photoCount} added
          </AppText>
        </View>

        {/* Submit action */}
        <Button
          title={isEditing ? "Save changes" : "Submit review"}
          onPress={submit}
          loading={isPending}
          disabled={!canSubmit}
          className="mt-6"
          fontClassName="text-sm font-bold"
          rounded="full"
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
