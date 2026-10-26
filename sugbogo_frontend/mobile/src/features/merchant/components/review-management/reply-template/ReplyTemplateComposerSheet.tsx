import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import Button from "@/shared/components/Button";
import FormInput from "@/shared/components/form/FormInput";
import FormTextArea from "@/shared/components/form/FormTextArea";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import { useReplyTemplates } from "../../../hooks/reply-templates/useReplyTemplates";
import type { ReplyTemplate } from "../../../types/reply-templates/replyTemplate.types";
import useMerchantSheetDraft from "../../../hooks/useMerchantSheetDraft";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import AppText from "@/shared/components/AppText";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  template?: ReplyTemplate | null;
  onDismiss: () => void;
};

type TemplateErrors = {
  title?: string;
  text?: string;
};

function templateDraft(template?: ReplyTemplate | null) {
  return {
    source: template,
    title: template?.title ?? "",
    text: template?.text ?? "",
    baselineTitle: template?.title ?? "",
    baselineText: template?.text ?? "",
  };
}

/**
 * Provides a focused composer for creating or editing a reusable
 * review reply template. Validation errors appear after submission
 * attempts and are cleared when the corresponding field is focused.
 */
export default function ReplyTemplateComposerSheet({
  sheetRef,
  template,
  onDismiss,
}: Props) {
  const {
    createTemplateAsync,
    updateTemplateAsync,
    isCreating,
    isUpdating,
    createError,
    updateError,
  } = useReplyTemplates();

  const [draft, setDraft] = useState(() => templateDraft(template));
  const { title, text } = draft;
  const setTitle = (value: string) =>
    setDraft((current) => ({ ...current, title: value }));
  const setText = (value: string) =>
    setDraft((current) => ({ ...current, text: value }));
  const [errors, setErrors] = useState<TemplateErrors>({});

  const isEditing = Boolean(template);
  const dirty =
    title.trim() !== draft.baselineTitle.trim() ||
    text.trim() !== draft.baselineText.trim();
  // A new selection resets the composer; refetches only refresh a pristine draft.
  if (
    draft.source !== template &&
    (draft.source?.id !== template?.id || !dirty)
  ) {
    setDraft(templateDraft(template));
    setErrors({});
  }
  const sheet = useMerchantSheetDraft(
    sheetRef,
    dirty,
    isCreating || isUpdating,
    template?.id ?? null,
  );
  const isPending = sheet.pending;

  const trimmedTitle = title.trim();
  const trimmedText = text.trim();

  const hasChanges = dirty;

  const canSubmit =
    !isPending &&
    trimmedTitle.length > 0 &&
    trimmedText.length > 0 &&
    hasChanges;

  useEffect(() => {
    const error = createError || updateError;

    if (!error) {
      return;
    }

    const response = error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: isEditing
          ? "Unable to update template"
          : "Unable to create template",
        text2: response.message || "Please try again.",
      });
    }
  }, [createError, updateError, isEditing]);

  const clearFieldError = (field: keyof TemplateErrors) => {
    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));
  };

  const validate = (): TemplateErrors => {
    const validationErrors: TemplateErrors = {};

    if (!trimmedTitle) {
      validationErrors.title = "Template name is required.";
    } else if (trimmedTitle.length < 2) {
      validationErrors.title = "Template name must be at least 2 characters.";
    }

    if (!trimmedText) {
      validationErrors.text = "Response is required.";
    } else if (trimmedText.length < 10) {
      validationErrors.text = "Response must be at least 10 characters.";
    }

    return validationErrors;
  };

  const resetForm = () => {
    setDraft(templateDraft(template));
    setErrors({});
  };

  const submit = async () => {
    if (isPending) {
      return;
    }

    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const token = sheet.beginSave();
    if (token === null) return;
    try {
      if (isEditing && template) {
        await updateTemplateAsync({
          templateId: template.id,
          title: trimmedTitle,
          text: trimmedText,
        });

        Toast.show({
          type: "success",
          text1: "Template updated",
        });
      } else {
        await createTemplateAsync({
          title: trimmedTitle,
          text: trimmedText,
        });

        Toast.show({
          type: "success",
          text1: "Template created",
        });
      }

      sheet.completeSave(token);
    } catch {
      // API errors are handled through the mutation error state.
    } finally {
      sheet.endSave();
    }
  };

  const handleDismiss = () => {
    sheet.onDismiss();
    resetForm();
    onDismiss();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["75%"]}
      enableDynamicSizing={false}
      enablePanDownToClose={!isPending}
      enableDismissOnClose={false}
      onChange={sheet.onChange}
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      onDismiss={handleDismiss}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.45}
          pressBehavior="none"
          onPress={sheet.requestDismiss}
        />
      )}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-5 pb-32 pt-3"
      >
        {/* Sheet header */}
        <View className="flex-row items-start">
          <View className="flex-1 pr-3">
            <AppText weight="bold" className="text-xl text-text-primary">
              {isEditing ? "Edit reply template" : "Add reply template"}
            </AppText>

            <AppText className="mt-2 text-xs leading-5 text-text-secondary">
              {isEditing
                ? "Update this reusable response for customer reviews."
                : "Save a response you can reuse when replying to customer reviews."}
            </AppText>
          </View>

          <Pressable
            onPress={sheet.requestDismiss}
            disabled={isPending}
            accessibilityRole="button"
            accessibilityLabel="Close"
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

        {/* Template name */}
        <View className="mt-5">
          <FormInput
            label="Template name"
            editable={!isPending}
            accessibilityState={{ disabled: isPending }}
            value={title}
            onChangeText={(value) => {
              if (!sheet.savingRef.current && !isPending) setTitle(value);
            }}
            onFocus={() => clearFieldError("title")}
            placeholder="e.g. Thank you"
            required
            error={errors.title}
            showCharacterCount
            minLength={2}
            maxLength={100}
            InputComponent={BottomSheetTextInput}
          />
        </View>

        {/* Template response */}
        <View className="mt-3">
          <FormTextArea
            label="Response"
            editable={!isPending}
            accessibilityState={{ disabled: isPending }}
            value={text}
            onChangeText={(value) => {
              if (!sheet.savingRef.current && !isPending) setText(value);
            }}
            onFocus={() => clearFieldError("text")}
            placeholder="Write your reusable response"
            maxLength={1000}
            showCharacterCount
            minLength={10}
            required
            error={errors.text}
            InputComponent={BottomSheetTextInput}
          />
        </View>

        {/* Save action */}
        <Button
          title={isEditing ? "Save changes" : "Create template"}
          onPress={submit}
          loading={isPending}
          disabled={!canSubmit}
          className="mt-5"
          fontClassName="text-sm font-bold"
          rounded="full"
        />
      </BottomSheetScrollView>
      <ConfirmModal
        visible={sheet.showDiscard}
        title="Discard template changes?"
        message="Your unsaved template changes will be lost."
        confirmText="Discard"
        cancelText="Keep Editing"
        destructive
        onCancel={sheet.keepEditing}
        onConfirm={sheet.discard}
      />
    </BottomSheetModal>
  );
}
