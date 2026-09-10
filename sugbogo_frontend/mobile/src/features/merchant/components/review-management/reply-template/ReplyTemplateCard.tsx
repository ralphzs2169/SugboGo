import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import ActionBottomSheet from "@/shared/components/bottom-sheets/ActionBottomSheet";
import AppText from "@/shared/components/AppText";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import { useReplyTemplates } from "../../../hooks/reply-templates/useReplyTemplates";

type Props = {
  id: number;
  title: string;
  text: string;
  onEdit: () => void;
};

/**
 * Displays a reusable reply template with an expandable response preview.
 *
 * Provides edit and delete actions while keeping long saved responses compact
 * until the merchant chooses to read the full template.
 */
export default function ReplyTemplateCard({ id, title, text, onEdit }: Props) {
  const actionSheetRef = useRef<BottomSheetModal | null>(null);

  const [isDeleteVisible, setIsDeleteVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  const { deleteTemplateAsync, isDeleting } = useReplyTemplates();

  const handleDelete = async () => {
    try {
      await deleteTemplateAsync({
        templateId: id,
      });

      Toast.show({
        type: "success",
        text1: "Template deleted",
      });

      setIsDeleteVisible(false);
    } catch (error) {
      const response = error as unknown as ApiResponse<unknown>;

      if (!response.success && !handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to delete template",
          text2: response.message || "Please try again.",
        });
      }
    }
  };

  return (
    <View className="overflow-hidden rounded-card border border-border-primary bg-surface">
      {/* Template header */}
      <View className="flex-row items-start px-4 pb-3 pt-4">
        <View className="h-10 w-10 shrink-0 items-center justify-center">
          <MaterialCommunityIcons
            name="message-text-outline"
            size={20}
            color={theme.extends.colors.text.secondary}
          />
        </View>

        <View className="min-w-0 flex-1 pt-0.5">
          <AppText
            weight="bold"
            className="text-base text-text-primary"
            numberOfLines={1}
          >
            {title}
          </AppText>

          <AppText className="mt-0.5 text-xs text-text-tertiary">
            Saved response
          </AppText>
        </View>

        {/* Template actions */}
        <Pressable
          onPress={() => actionSheetRef.current?.present()}
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${title}`}
          hitSlop={8}
          className="h-9 w-9 cursor-pointer items-center justify-center rounded-full active:bg-background"
        >
          <MaterialCommunityIcons
            name="dots-horizontal"
            size={21}
            color={theme.extends.colors.text.secondary}
          />
        </Pressable>
      </View>

      {/* Reply preview */}
      <View className="mx-4 mb-4 rounded-xl bg-background px-3.5 py-3">
        <View className="mb-1.5 flex-row items-center">
          <MaterialCommunityIcons
            name="format-quote-open"
            size={15}
            color={theme.extends.colors.text.tertiary}
          />

          <AppText
            weight="semibold"
            className="ml-1 text-[11px] uppercase tracking-wide text-text-tertiary"
          >
            Response
          </AppText>
        </View>

        <AppText
          className="text-sm leading-5 text-text-secondary"
          numberOfLines={isExpanded ? undefined : 3}
          onTextLayout={(event) => {
            if (!isExpanded) {
              setIsTruncated(event.nativeEvent.lines.length >= 3);
            }
          }}
        >
          {text}
        </AppText>

        {isTruncated && (
          <Pressable
            onPress={() => setIsExpanded((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded ? "Show less response" : "Read full response"
            }
            className="mt-2 cursor-pointer self-start active:opacity-70"
          >
            <AppText weight="semibold" className="text-xs text-brand">
              {isExpanded ? "Show less" : "Read more"}
            </AppText>
          </Pressable>
        )}
      </View>

      {/* Action menu */}
      <ActionBottomSheet
        sheetRef={actionSheetRef}
        options={[
          {
            label: "Edit template",
            value: "edit",
          },
          {
            label: "Delete template",
            value: "delete",
            color: theme.extends.colors.error,
          },
        ]}
        onSelect={(value) => {
          if (value === "edit") {
            onEdit();
          }

          if (value === "delete") {
            setIsDeleteVisible(true);
          }
        }}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        visible={isDeleteVisible}
        title="Delete template?"
        message={`"${title}" will be permanently deleted.`}
        confirmText="Delete"
        destructive
        isLoading={isDeleting}
        loadingText="Deleting template..."
        onCancel={() => setIsDeleteVisible(false)}
        onConfirm={handleDelete}
      />
    </View>
  );
}
