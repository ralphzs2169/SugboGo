import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const MIN_REVIEW_LENGTH = 25;
const MAX_REVIEW_LENGTH = 1000;

/**
 * Compact card showing which business the review is for.
 */
function BusinessContext({
  businessName,
  coverPhotoUrl,
}: {
  businessName: string;
  coverPhotoUrl?: string | null;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`You're reviewing ${businessName}`}
      className="flex-row items-center rounded-2xl bg-background p-3"
    >
      <View className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border-primary bg-surface">
        <View className="h-full w-full items-center justify-center">
          <MaterialCommunityIcons
            name="store-outline"
            size={22}
            color={theme.extends.colors.text.secondary}
          />
        </View>

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
        <AppText className="text-[11px] text-text-secondary" numberOfLines={1}>
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
  );
}

/**
 * Provides the review composer for creating or editing a business review.
 *
 * Presents compact business context, review text and photo controls, validation,
 * and submission feedback while preserving existing review data during edits.
 * The submit action lives in a sticky footer that respects the bottom safe area,
 * so it never collides with the system navigation bar or gesture area.
 */
export default function ReviewComposerSheet({
  businessId,
  businessName,
  coverPhotoUrl,
  sheetRef,
  review,
}: Props) {
  const insets = useSafeAreaInsets();

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
  const [showInCommunity, setShowInCommunity] = useState(true);
  const [originalShowInCommunity, setOriginalShowInCommunity] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [errors, setErrors] = useState<ReviewErrors>({});

  const isEditing = Boolean(review);
  const isPending = isCreatePending || isUpdatePending;

  const photoCount = photos.length + existingPhotos.length;
  const canAddMore = photoCount < MAX_REVIEW_PHOTOS;

  const trimmedText = text.trim();

  // Change tracking (computed once, reused by validation, submit and the button)
  const textChanged = trimmedText !== originalText.trim();
  const existingPhotosChanged =
    existingPhotos.length !== originalPhotoIds.length ||
    existingPhotos.some((photo) => !originalPhotoIds.includes(photo.id));
  const photosChanged = photos.length > 0 || existingPhotosChanged;
  const communityChanged = showInCommunity !== originalShowInCommunity;

  const hasChanges =
    !isEditing || textChanged || photosChanged || communityChanged;
  const canSubmit = !isPending && hasChanges;

  function resetForm() {
    const initialText = review?.text ?? "";
    const initialPhotos = review?.photos ?? [];
    const initialCommunity = review?.show_in_community ?? true;

    setText(initialText);
    setPhotos([]);
    setExistingPhotos(initialPhotos);
    setOriginalText(initialText);
    setOriginalPhotoIds(initialPhotos.map((photo) => photo.id));
    setShowInCommunity(initialCommunity);
    setOriginalShowInCommunity(initialCommunity);
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

    if (!isEditing || textChanged) {
      if (!trimmedText) {
        validationErrors.text = "Review is required.";
      } else if (trimmedText.length < MIN_REVIEW_LENGTH) {
        validationErrors.text = `Review must be at least ${MIN_REVIEW_LENGTH} characters.`;
      }
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

  async function submit() {
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
          text: textChanged ? trimmedText : undefined,
          photos,
          keepPhotoIds: photosChanged
            ? existingPhotos.map((photo) => photo.id)
            : undefined,
          showInCommunity: communityChanged ? showInCommunity : undefined,
          textChanged,
        });

        Toast.show({ type: "success", text1: "Review updated" });
      } else {
        const created = await createReview({
          text: trimmedText,
          photos,
          showInCommunity,
        });

        if (created.status === "under_review") {
          Toast.show({
            type: "success",
            text1: "Review submitted",
            text2: "It's being reviewed before it appears publicly.",
          });
        } else {
          Toast.show({ type: "success", text1: "Review added" });
        }
      }

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
    // The form intentionally mirrors the review selected by the parent screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{
        backgroundColor: theme.extends.colors.surface,
        borderRadius: 28,
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
      <View className="flex-1">
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-screen-x pb-6 pt-2"
        >
          {/* Heading */}
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <AppText weight="bold" className="text-xl text-text-primary">
                {isEditing ? "Edit review" : "Write a review"}
              </AppText>

              <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                {isEditing
                  ? "Update what you shared about your experience."
                  : "Share your experience to help other explorers."}
              </AppText>
            </View>

            <Pressable
              onPress={() => sheetRef.current?.dismiss()}
              disabled={isPending}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="h-9 w-9 items-center justify-center rounded-full bg-background active:opacity-70 disabled:opacity-50"
            >
              <MaterialCommunityIcons
                name="close"
                size={18}
                color={theme.extends.colors.text.secondary}
              />
            </Pressable>
          </View>

          {/* Business context */}
          <View className="mt-5">
            <BusinessContext
              businessName={businessName}
              coverPhotoUrl={coverPhotoUrl}
            />
          </View>

          {/* Review text */}
          <View className="mt-6">
            <AppText
              weight="semibold"
              className="mb-2 text-sm text-text-primary"
            >
              Your experience
            </AppText>

            <FormTextArea
              label="Your review"
              showLabel={false}
              value={text}
              onChangeText={setText}
              onFocus={() => clearFieldError("text")}
              placeholder="What stood out about your visit?"
              maxLength={MAX_REVIEW_LENGTH}
              showCharacterCount
              minLength={MIN_REVIEW_LENGTH}
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

          {/* Photos */}
          <View className="mt-6">
            <View className="mb-3 flex-row items-center justify-between">
              <View>
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
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
                  className="h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-border-secondary bg-background active:opacity-70 disabled:opacity-50"
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

          {/* Community preference */}
          <View className="mt-6 rounded-2xl bg-background p-4">
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Show in Community
                </AppText>

                <AppText className="mt-1 text-xs leading-4 text-text-secondary">
                  Let other explorers discover your review in the Community
                  feed. It stays on the business profile either way.
                </AppText>
              </View>

              <Switch
                value={showInCommunity}
                onValueChange={setShowInCommunity}
                disabled={isPending}
                accessibilityRole="switch"
                accessibilityLabel="Show in Community"
                accessibilityHint="Allow other explorers to discover your review in the Community feed"
                accessibilityState={{
                  checked: showInCommunity,
                  disabled: isPending,
                }}
                trackColor={{ true: theme.extends.colors.brand }}
              />
            </View>
          </View>
        </BottomSheetScrollView>

        {/* Sticky footer: padded by the bottom inset so it clears the system nav bar */}
        <View
          className="border-t border-border-primary bg-surface px-screen-x pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <Button
            title={isEditing ? "Save changes" : "Submit review"}
            onPress={submit}
            loading={isPending}
            disabled={!canSubmit}
            textWeight="bold"
            rounded="full"
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}
