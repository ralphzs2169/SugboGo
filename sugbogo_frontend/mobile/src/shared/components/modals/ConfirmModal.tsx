import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import Button from "../Button";
import { ReactNode } from "react";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onCancel: () => void;
  onConfirm: () => void;
  destructive?: boolean;

  /**
   * Shows a loading state while the confirmation action
   * is being processed.
   */
  isLoading?: boolean;

  /**
   * Message displayed beneath the confirmation message
   * while loading.
   */
  loadingText?: string;

  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

/**
 * Displays a reusable confirmation dialog.
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
  isLoading = false,
  loadingText = "Please wait...",
  icon,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      onRequestClose={() => {
        if (!isLoading) {
          onCancel();
        }
      }}
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-sm rounded-2xl bg-white p-6">
          {icon && (
            <View className="mb-5 items-center">
              <View
                className="h-16 w-16 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${theme.extends.colors.brand}15`,
                }}
              >
                <MaterialCommunityIcons
                  name={icon}
                  size={30}
                  color={theme.extends.colors.brand}
                />
              </View>
            </View>
          )}
          <Text className="text-lg font-bold text-text-primary">{title}</Text>

          <Text className="mt-3 text-sm leading-5 text-text-secondary">
            {message}
          </Text>

          {isLoading && (
            <View className="mt-5 flex-row items-center">
              <ActivityIndicator
                size="small"
                color={theme.extends.colors.brand}
              />

              <Text className="ml-3 text-sm text-text-secondary">
                {loadingText}
              </Text>
            </View>
          )}
          <View className="mt-6 flex-row gap-3">
            <Button
              title={cancelText}
              onPress={onCancel}
              disabled={isLoading}
              variant="outline"
              className="flex-[3]"
            />

            <Button
              title={confirmText}
              onPress={onConfirm}
              disabled={isLoading}
              variant={destructive ? "danger" : "primary"}
              className="flex-[7]"
              fontClassName="fole-bold"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
