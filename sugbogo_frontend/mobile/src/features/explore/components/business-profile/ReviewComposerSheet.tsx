import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { pickBusinessPhotos } from "@/features/merchant/components/registration/business-photos/PhotoPicker";
import PhotoPreview from "@/features/merchant/components/registration/business-photos/PhotoPreview";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import FormTextArea from "@/shared/components/form/FormTextArea";
import { MAX_REVIEW_PHOTOS } from "@/shared/constants/media.constants";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import {
  useCreateReview,
  useUpdateReview,
} from "../../hooks/useBusinessReviews";
import type {
  BusinessReview,
  LocalReviewPhoto,
  ReviewPhoto,
} from "../../types/review.types";

type Props = {
  businessId: number;
  businessName: string;
  coverPhotoUrl?: string | null;
  sheetRef: React.RefObject<BottomSheetModal | null>;
  review?: BusinessReview | null;
};

type ReviewErrors = {
  text?: string;
};

/**
 * Provides the review composer for creating or editing a business review.
 *
 * Presents compact business context, review text and photo controls, validation,
 * and submission feedback while preserving existing review data during edits.
 */
export default function ReviewComposerSheet({
  businessId,
  businessName,
  coverPhotoUrl,
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

  function hasReviewChanges() {
    if (!isEditing) {
      return true;
    }

    const textChanged = trimmedText !== originalText.trim();

    const existingPhotosChanged =
      existingPhotos.length !== originalPhotoIds.length ||
      existingPhotos.some((photo) => !originalPhotoIds.includes(photo.id));

    const newPhotosAdded = photos.length > 0;

    return textChanged || existingPhotosChanged || newPhotosAdded;
  }

  function resetForm() {
    const initialText = review?.text ?? "";
    const initialPhotos = review?.photos ?? [];

    setText(initialText);
    setPhotos([]);
    setExistingPhotos(initialPhotos);
    setOriginalText(initialText);
    setOriginalPhotoIds(initialPhotos.map((photo) => photo.id));
    setErrors({});
  }

  function clearFieldError(field: keyof ReviewErrors) {
    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));
  }

  function validate(): ReviewErrors {
    const validationErrors: ReviewErrors = {};

    if (!trimmedText) {
      validationErrors.text = "Review is required.";
    } else if (trimmedText.length < 25) {
      validationErrors.text = "Review must be at least 25 characters.";
    }

    return validationErrors;
  }

  async function addPhotos() {
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
  }

  function removeExistingPhoto(photoId: number) {
    if (isPending) {
      return;
    }

    setExistingPhotos((current) =>
      current.filter((photo) => photo.id !== photoId),
    );
  }

  function removePhoto(index: number) {
    if (isPending) {
      return;
    }

    setPhotos((current) =>
      current.filter((_, photoIndex) => photoIndex !== index),
    );
  }

  const canSubmit = !isPending && (!isEditing || hasReviewChanges());

  async function submit() {
    if (isPending || !canSubmit) {
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
      // Mutation error state handles API feedback.
    }
  }

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

    return () => {
      subscription.remove();
    };
  }, [isSheetOpen, sheetRef]);

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

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["90%"]}
      enableDynamicSizing={false}
      enablePanDownToClose={!isPending}
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      backgroundStyle={{
        backgroundColor: theme.extends.colors.surface,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.disabled,
        width: 40,
      }}
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
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-screen-x pb-10 pt-2"
      >
        {/* Review heading */}
        <View>
          <AppText weight="bold" className="text-xl text-text-primary">
            {isEditing ? "Edit review" : "Write a review"}
          </AppText>

          <AppText className="mt-1 text-sm leading-5 text-text-secondary">
            {isEditing
              ? "Update what you shared about your experience."
              : "Share your experience to help other explorers."}
          </AppText>
        </View>

        {/* Business context */}
        <View
          accessible
          accessibilityLabel={`You're reviewing ${businessName}`}
          className="mt-5 flex-row items-center rounded-xl bg-background p-3"
        >
          <View className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border-primary bg-surface">
            {/* Cover photo fallback */}
            <View className="h-full w-full items-center justify-center">
              <MaterialCommunityIcons
                name="store-outline"
                size={22}
                color={theme.extends.colors.text.secondary}
              />
            </View>

            {/* Business cover photo */}
            {coverPhotoUrl && (
              <Image
                source={{ uri: coverPhotoUrl }}
                contentFit="cover"
                accessible={false}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                }}
              />
            )}
          </View>

          <View className="ml-3 min-w-0 flex-1">
            <AppText
              className="text-[11px] text-text-secondary"
              numberOfLines={1}
            >
              You&apos;re reviewing
            </AppText>

            <AppText
              weight="semibold"
              numberOfLines={2}
              className="mt-0.5 text-sm leading-5 text-text-primary"
            >
              {businessName}
            </AppText>
          </View>
        </View>

        {/* Review text */}
        <View className="mt-5">
          <AppText weight="semibold" className="mb-2 text-sm text-text-primary">
            Your experience
          </AppText>

          <FormTextArea
            label="Your review"
            showLabel={false}
            value={text}
            onChangeText={setText}
            onFocus={() => clearFieldError("text")}
            placeholder="What stood out about your visit?"
            maxLength={1000}
            showCharacterCount
            minLength={25}
            required
            error={errors.text}
            editable={!isPending}
            InputComponent={BottomSheetTextInput}
          />

          <View className="mt-2 flex-row items-center">
            <MaterialCommunityIcons
              name="information-outline"
              size={14}
              color={theme.extends.colors.text.tertiary}
            />

            <AppText className="ml-1.5 flex-1 text-xs leading-4 text-text-tertiary">
              One review per business. You can update it later.
            </AppText>
          </View>
        </View>

        {/* Review photos */}
        <View className="mt-5">
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <AppText weight="semibold" className="text-sm text-text-primary">
                Photos
              </AppText>

              <AppText className="mt-0.5 text-xs text-text-secondary">
                Optional · Add up to {MAX_REVIEW_PHOTOS}
              </AppText>
            </View>

            <View className="rounded-full bg-background px-2.5 py-1">
              <AppText
                weight="medium"
                className="text-[11px] text-text-secondary"
              >
                {photoCount}/{MAX_REVIEW_PHOTOS}
              </AppText>
            </View>
          </View>

          {/* Photo previews */}
          <View className="flex-row flex-wrap gap-3">
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
                onRemove={isPending ? undefined : () => removePhoto(index)}
              />
            ))}

            {canAddMore && (
              <Pressable
                onPress={addPhotos}
                disabled={isPicking || isPending}
                accessibilityRole="button"
                accessibilityLabel="Add review photo"
                className="h-24 w-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border-secondary bg-background active:opacity-70 disabled:opacity-50"
              >
                {isPicking ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.extends.colors.brand}
                  />
                ) : (
                  <>
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-surface">
                      <MaterialCommunityIcons
                        name="image-plus-outline"
                        size={18}
                        color={theme.extends.colors.text.secondary}
                      />
                    </View>

                    <AppText
                      weight="medium"
                      className="mt-1.5 text-[11px] text-text-secondary"
                    >
                      Add photo
                    </AppText>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>

        {/* Submit action */}
        <Button
          title={isEditing ? "Save changes" : "Submit review"}
          onPress={submit}
          loading={isPending}
          disabled={!canSubmit}
          className="mt-7"
          textWeight="bold"
          rounded="full"
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
