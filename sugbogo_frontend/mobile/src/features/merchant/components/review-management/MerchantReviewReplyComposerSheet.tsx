import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

import { pickBusinessPhotos } from "@/features/merchant/components/registration/business-photos/PhotoPicker";
import PhotoPreview from "@/features/merchant/components/registration/business-photos/PhotoPreview";
import Button from "@/shared/components/Button";
import FormTextArea from "@/shared/components/form/FormTextArea";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { theme } from "@/constants/theme";

import {
  useCreateReviewReply,
  useUpdateReviewReply,
} from "../../hooks/review-reply/useReviewReplies";
import { useReplyTemplates } from "../../hooks/reply-templates/useReplyTemplates";
import type { ReplyTemplate } from "../../types/reply-templates/replyTemplate.types";
import type {
  LocalReviewPhoto,
  ReviewPhoto,
} from "../../types/review-reply/reviewReply.types";
import { BusinessReview } from "@/features/explore/types/review.types";
import QuickResponses from "./QuickResponses";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import { MAX_REVIEW_PHOTOS } from "@/shared/constants/media.constants";

type Props = {
  businessId: number;
  review: BusinessReview | null;
  sheetRef: React.RefObject<BottomSheetModal | null>;
  onDismiss: () => void;
};

/**
 * Creates and updates the merchant's single reply to a customer review.
 *
 * Supports reusable response templates, optional photos, editing existing
 * replies, and bottom-sheet-aware keyboard handling within a single modal.
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

  const {
    templates,
    isLoading: isTemplatesLoading,
    error: templatesError,
    refetch: refetchTemplates,
  } = useReplyTemplates();

  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<LocalReviewPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ReviewPhoto[]>([]);
  const [originalText, setOriginalText] = useState("");
  const [originalPhotoIds, setOriginalPhotoIds] = useState<number[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<ReplyTemplate | null>(
    null,
  );

  const isEditing = Boolean(review?.reply);
  const isPending = isCreatePending || isUpdatePending;

  const photoCount = photos.length + existingPhotos.length;
  const canAddMore = photoCount < MAX_REVIEW_PHOTOS;

  useEffect(() => {
    const reply = review?.reply;
    const initialText = reply?.text ?? "";
    const initialPhotos = reply?.photos ?? [];

    setText(initialText);
    setPhotos([]);
    setExistingPhotos(initialPhotos);
    setOriginalText(initialText);
    setOriginalPhotoIds(initialPhotos.map((photo) => photo.id));
    setShowTemplates(false);
  }, [review]);

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
          text1: review.reply
            ? "Unable to update reply"
            : "Unable to send reply",
          text2: response.message || "Please try again.",
        });
      }
    }
  };

  const applyTemplate = (template: ReplyTemplate) => {
    setText(template.text);
    setShowTemplates(false);
    setPendingTemplate(null);

    Toast.show({
      type: "info",
      text1: "Template applied",
    });
  };

  const handleSelectTemplate = (template: ReplyTemplate) => {
    if (text.trim().length > 0) {
      setPendingTemplate(template);
      return;
    }

    applyTemplate(template);
  };

  const openTemplatePicker = () => {
    if (isPending) {
      return;
    }

    setShowTemplates(true);
  };

  const closeTemplatePicker = () => {
    setShowTemplates(false);
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!isSheetOpen) {
          return false;
        }

        if (showTemplates) {
          setShowTemplates(false);
          return true;
        }

        sheetRef.current?.dismiss();
        return true;
      },
    );

    return () => subscription.remove();
  }, [isSheetOpen, showTemplates, sheetRef]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["90%"]}
      enableDynamicSizing={false}
      enablePanDownToClose={!isPending}
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      onChange={(index) => {
        setIsSheetOpen(index >= 0);
      }}
      onDismiss={() => {
        setShowTemplates(false);
        onDismiss();
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
      {showTemplates ? (
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-5 pb-10 pt-3"
          showsVerticalScrollIndicator={false}
        >
          {/* Template picker header */}
          <View className="flex-row items-start">
            <Pressable
              onPress={closeTemplatePicker}
              accessibilityRole="button"
              accessibilityLabel="Back to reply composer"
              hitSlop={8}
              className="mr-2 cursor-pointer rounded-full p-1 active:opacity-60"
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={24}
                color={theme.extends.colors.text.secondary}
              />
            </Pressable>

            <View className="flex-1 pr-3">
              <Text
                className="text-xl font-bold text-text-primary"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Quick Responses
              </Text>

              <Text className="text-xs leading-5 text-text-secondary">
                Choose a saved response to quickly reply.
              </Text>
            </View>

            <Pressable
              onPress={() => sheetRef.current?.dismiss()}
              accessibilityRole="button"
              accessibilityLabel="Close response templates"
              hitSlop={8}
              className="cursor-pointer rounded-full p-1 active:opacity-60"
            >
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={theme.extends.colors.text.secondary}
              />
            </Pressable>
          </View>

          {isTemplatesLoading ? (
            /* Template loading state */
            <View className="items-center justify-center py-16">
              <ActivityIndicator
                size="small"
                color={theme.extends.colors.brand}
              />
            </View>
          ) : templatesError ? (
            /* Template error state */
            <View className="items-center py-10">
              <MaterialCommunityIcons
                name="text-box-remove-outline"
                size={38}
                color={theme.extends.colors.text.tertiary}
              />

              <Text className="mt-3 text-base font-bold text-text-primary">
                Unable to load templates
              </Text>

              <Text className="mt-1 text-center text-sm leading-5 text-text-secondary">
                We couldn't load your response templates right now.
              </Text>

              <Pressable
                onPress={() => {
                  void refetchTemplates();
                }}
                accessibilityRole="button"
                accessibilityLabel="Retry loading response templates"
                className="mt-4 cursor-pointer rounded-lg px-4 py-2 active:opacity-70"
              >
                <Text className="text-sm font-bold text-brand">Retry</Text>
              </Pressable>
            </View>
          ) : templates.length === 0 ? (
            /* Template empty state */
            <View className="items-center rounded-card border border-border-primary bg-surface px-6 py-10">
              <MaterialCommunityIcons
                name="text-box-multiple-outline"
                size={38}
                color={theme.extends.colors.text.tertiary}
              />

              <Text className="mt-3 text-base font-bold text-text-primary">
                No response templates yet
              </Text>

              <Text className="mt-1 text-center text-sm leading-5 text-text-secondary">
                Create a template first to reuse responses when replying to
                reviews.
              </Text>
            </View>
          ) : (
            /* Template list */
            <View className="mt-5">
              {templates.map((template) => (
                <Pressable
                  key={template.id}
                  onPress={() => handleSelectTemplate(template)}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${template.title} template`}
                  className="mb-3 cursor-pointer rounded-card border border-border-primary bg-surface p-4 active:opacity-70"
                >
                  <View className="flex-row items-center">
                    <Text
                      className="flex-1 text-sm font-bold text-text-primary"
                      numberOfLines={1}
                    >
                      {template.title}
                    </Text>

                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={theme.extends.colors.text.tertiary}
                    />
                  </View>

                  <Text
                    className="mt-1.5 text-sm leading-5 text-text-secondary"
                    numberOfLines={3}
                  >
                    {template.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-5 pb-32 pt-3"
        >
          {/* Sheet header */}
          <Text
            className="text-xl font-bold text-text-primary"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {isEditing
              ? `Edit reply to ${review?.author.first_name} ${review?.author.last_name}`
              : `Reply to ${review?.author.first_name} ${review?.author.last_name}`}
          </Text>

          <Text className="mt-2 text-xs leading-5 text-text-secondary">
            Your reply will be visible publicly on this review.
          </Text>

          {/* Reply text */}
          <View className="mt-4">
            <FormTextArea
              label="Response"
              value={text}
              onChangeText={setText}
              placeholder="Write a helpful response"
              maxLength={1000}
              showCharacterCount
              required
              editable={!isPending}
              InputComponent={BottomSheetTextInput}
            />
          </View>
          <QuickResponses
            templates={templates}
            disabled={isPending}
            onSelect={handleSelectTemplate}
            onViewMore={openTemplatePicker}
          />
          {/* Reply photos */}
          <View className="mt-5">
            <Text className="mb-3 text-sm font-bold text-text-primary">
              Add photos (optional)
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
                  onRemove={isPending ? undefined : () => removeNewPhoto(index)}
                />
              ))}

              {canAddMore && (
                <Pressable
                  onPress={addPhotos}
                  disabled={isPicking || isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Add reply photo"
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
                        Add photo
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            <Text className="mt-3 text-xs text-text-secondary">
              Optional · Up to {MAX_REVIEW_PHOTOS} photos · {photoCount} added
            </Text>
          </View>

          {/* Save action */}
          <Button
            title={isEditing ? "Save changes" : "Send reply"}
            onPress={submit}
            loading={isPending}
            disabled={!canSubmit}
            className="mt-6"
            fontClassName="text-sm font-bold"
          />
        </BottomSheetScrollView>
      )}

      <ConfirmModal
        visible={Boolean(pendingTemplate)}
        title="Replace your draft?"
        message="Applying this template will replace what you've already written."
        confirmText="Replace"
        destructive
        onCancel={() => setPendingTemplate(null)}
        onConfirm={() => pendingTemplate && applyTemplate(pendingTemplate)}
      />
    </BottomSheetModal>
  );
}
