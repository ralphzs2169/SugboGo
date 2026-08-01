import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
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
      animationType="fade"
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

          <View className="mt-6 flex-row justify-end gap-2">
            <Pressable
              disabled={isLoading}
              onPress={onCancel}
              hitSlop={8}
              android_ripple={{ color: "#E5E7EB", borderless: false }}
              style={({ pressed }) => ({
                opacity: isLoading ? 0.45 : pressed ? 0.7 : 1,
              })}
              className="rounded-lg px-3 py-2"
            >
              <Text className="font-medium text-text-secondary">
                {cancelText}
              </Text>
            </Pressable>

            <Pressable
              disabled={isLoading}
              onPress={onConfirm}
              hitSlop={8}
              android_ripple={{
                color: destructive ? "#FECACA" : "#D1FAE5",
                borderless: false,
              }}
              style={({ pressed }) => ({
                opacity: isLoading ? 0.45 : pressed ? 0.7 : 1,
              })}
              className="rounded-lg px-3 py-2"
            >
              <Text
                className={
                  destructive
                    ? "font-bold text-red-500"
                    : "font-bold text-brand"
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
