import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Modal, View } from "react-native";

import { theme } from "@/constants/theme";

import AppText from "../AppText";
import Button from "../Button";

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

const LONG_ACTION_TEXT_LENGTH = 16;
const FADE_IN_DURATION = 130;
const FADE_OUT_DURATION = 100;

/**
 * Displays a reusable confirmation dialog with balanced actions.
 *
 * Uses a fast custom fade transition, equal-width actions for concise labels,
 * and vertically stacked actions when labels require additional space.
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
  const [isModalVisible, setIsModalVisible] = useState(visible);

  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  const shouldStackActions =
    confirmText.trim().length > LONG_ACTION_TEXT_LENGTH ||
    cancelText.trim().length > LONG_ACTION_TEXT_LENGTH;

  useEffect(() => {
    opacity.stopAnimation();

    if (visible) {
      opacity.setValue(0);
      setIsModalVisible(true);

      requestAnimationFrame(() => {
        Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_IN_DURATION,
          useNativeDriver: true,
        }).start();
      });

      return;
    }

    if (!isModalVisible) {
      return;
    }

    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_OUT_DURATION,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsModalVisible(false);
      }
    });
  }, [visible, isModalVisible, opacity]);

  return (
    <Modal
      visible={isModalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      presentationStyle="overFullScreen"
      hardwareAccelerated
      onRequestClose={() => {
        if (!isLoading) {
          onCancel();
        }
      }}
    >
      {/* Modal backdrop */}
      <Animated.View
        className="flex-1 items-center justify-center bg-black/50 px-6"
        style={{
          opacity,
        }}
      >
        {/* Confirmation dialog */}
        <View className="w-full max-w-sm rounded-2xl bg-white p-6">
          {/* Confirmation icon */}
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

          {/* Confirmation message */}
          <AppText weight="bold" className="text-lg text-text-primary">
            {title}
          </AppText>

          <View className="mt-3">
            {typeof message === "string" ? (
              <AppText className="text-sm leading-5 text-text-secondary">
                {message}
              </AppText>
            ) : (
              message
            )}
          </View>

          {/* Loading feedback */}
          {isLoading && (
            <View className="mt-5 flex-row items-center">
              <ActivityIndicator
                size="small"
                color={theme.extends.colors.brand}
              />

              <AppText className="ml-3 flex-1 text-sm text-text-secondary">
                {loadingText}
              </AppText>
            </View>
          )}

          {/* Confirmation actions */}
          <View
            className={`mt-6 gap-3 ${
              shouldStackActions ? "flex-col" : "flex-row"
            }`}
          >
            <Button
              title={cancelText}
              onPress={onCancel}
              disabled={isLoading}
              variant="outline"
              rounded="full"
              className={shouldStackActions ? "w-full" : "flex-1"}
            />

            <Button
              title={confirmText}
              onPress={onConfirm}
              disabled={isLoading}
              variant={destructive ? "danger" : "primary"}
              rounded="full"
              className={shouldStackActions ? "w-full" : "flex-1"}
              textWeight="bold"
            />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}
