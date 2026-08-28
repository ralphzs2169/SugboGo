import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import ActionBottomSheet from "@/shared/components/bottom-sheets/ActionBottomSheet";
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
 * Displays a saved reply template and provides merchant actions
 * for editing or permanently deleting the template.
 */
export default function ReplyTemplateCard({ id, title, text, onEdit }: Props) {
  const actionSheetRef = useRef<BottomSheetModal | null>(null);

  const [isDeleteVisible, setIsDeleteVisible] = useState(false);

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
    <View className="rounded-card border border-border-primary bg-surface">
      {/* Template content */}
      <View className="flex-row items-start px-4 py-4">
        <View className="flex-1 pr-3">
          <Text
            className="text-base font-bold text-text-primary"
            numberOfLines={1}
          >
            {title}
          </Text>

          <Text
            className="mt-1 text-sm leading-5 text-text-secondary"
            numberOfLines={2}
          >
            {text}
          </Text>
        </View>

        {/* Template actions */}
        <Pressable
          onPress={() => actionSheetRef.current?.present()}
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${title}`}
          hitSlop={8}
          className="h-11 w-11 cursor-pointer items-center justify-center rounded-full active:bg-surface-secondary"
        >
          <MaterialCommunityIcons
            name="dots-vertical"
            size={22}
            color={theme.extends.colors.text.secondary}
          />
        </Pressable>
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
