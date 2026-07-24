import { Modal, Pressable, Text, View } from "react-native";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onCancel: () => void;
  onConfirm: () => void;
  destructive?: boolean;
}

/**
 * ConfirmModal component displays a modal dialog that prompts the user to confirm or cancel an action.
 */
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onCancel,
  onConfirm,
  destructive = false,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="w-80 rounded-2xl bg-white p-6">
          <Text className="text-lg font-bold text-gray-900">{title}</Text>

          <Text className="mt-3 text-sm text-gray-600">{message}</Text>

          <View className="mt-6 flex-row justify-end gap-3">
            <Pressable onPress={onCancel}>
              <Text className="text-gray-500">{cancelText}</Text>
            </Pressable>

            <Pressable onPress={onConfirm}>
              <Text
                className={
                  destructive
                    ? "font-bold text-red-500"
                    : "font-bold text-primary"
                }
              >
                {confirmText}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
