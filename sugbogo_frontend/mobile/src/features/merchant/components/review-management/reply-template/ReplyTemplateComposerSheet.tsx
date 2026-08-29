import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import Button from "@/shared/components/Button";
import FormInput from "@/shared/components/form/FormInput";
import FormTextArea from "@/shared/components/form/FormTextArea";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import { useReplyTemplates } from "../../../hooks/reply-templates/useReplyTemplates";
import type { ReplyTemplate } from "../../../types/reply-templates/replyTemplate.types";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  template?: ReplyTemplate | null;
  onDismiss: () => void;
};

type TemplateErrors = {
  title?: string;
  text?: string;
};

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

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<TemplateErrors>({});

  const isEditing = Boolean(template);
  const isPending = isCreating || isUpdating;

  const trimmedTitle = title.trim();
  const trimmedText = text.trim();

  const hasChanges = template
    ? trimmedTitle !== template.title.trim() ||
      trimmedText !== template.text.trim()
    : true;

  const canSubmit =
    !isPending &&
    trimmedTitle.length > 0 &&
    trimmedText.length > 0 &&
    hasChanges;

  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setText(template.text);
    } else {
      setTitle("");
      setText("");
    }

    setErrors({});
  }, [template]);

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
    setTitle("");
    setText("");
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

      resetForm();
      sheetRef.current?.dismiss();
    } catch {
      // API errors are handled through the mutation error state.
    }
  };

  const handleDismiss = () => {
    if (!isPending) {
      resetForm();
      onDismiss();
    }
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["75%"]}
      enableDynamicSizing={false}
      enablePanDownToClose={!isPending}
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      onDismiss={handleDismiss}
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
        <View className="flex-row items-start">
          <View className="flex-1 pr-3">
            <Text className="text-xl font-bold text-text-primary">
              {isEditing ? "Edit reply template" : "Add reply template"}
            </Text>

            <Text className="mt-2 text-xs leading-5 text-text-secondary">
              {isEditing
                ? "Update this reusable response for customer reviews."
                : "Save a response you can reuse when replying to customer reviews."}
            </Text>
          </View>

          <Pressable
            onPress={() => sheetRef.current?.dismiss()}
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
            value={title}
            onChangeText={setTitle}
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
            value={text}
            onChangeText={setText}
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
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
