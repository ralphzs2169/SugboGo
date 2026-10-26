import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Linking, Pressable, View } from "react-native";
import * as Sharing from "expo-sharing";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import type { BusinessDocument } from "@/features/merchant/types/registration/registrationOption.types";
import ImagePreviewModal from "@/shared/components/modals/ImagePreviewModal";
import AppText from "@/shared/components/AppText";

type DocumentPreviewProps = {
  document: BusinessDocument;
  onRemove?: () => void;
  showRemove?: boolean;
  className?: string;
};

export default function DocumentPreview({
  document,
  onRemove,
  showRemove = true,
  className = "",
}: DocumentPreviewProps) {
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const isImage = document.mimeType?.startsWith("image/");

  const handlePreview = async () => {
    if (isImage) {
      setIsPreviewVisible(true);
      return;
    }

    try {
      if (/^file:\/\//i.test(document.uri)) {
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error("Local document handoff is unavailable.");
        }
        await Sharing.shareAsync(document.uri, {
          mimeType: document.mimeType ?? undefined,
          UTI:
            document.mimeType === "application/pdf"
              ? "com.adobe.pdf"
              : undefined,
          dialogTitle: "Open document with another app",
        });
      } else if (/^(https?:\/\/|content:\/\/)/i.test(document.uri)) {
        // Keep persisted URLs and provider URIs on their existing open path.
        await Linking.openURL(document.uri);
      } else {
        throw new Error("Unsupported document URI.");
      }
    } catch {
      Toast.show({
        type: "error",
        text1: "Unable to open document",
        text2:
          "This device cannot open the document right now. Try again with a compatible viewer. Your document has not been changed.",
      });
    }
  };

  return (
    <>
      <View
        className={`relative flex-row items-center rounded-lg border border-border-primary p-2 ${className}`}
      >
        <Pressable
          onPress={handlePreview}
          className="flex-row flex-1 items-center pressed:opacity-70"
        >
          {isImage ? (
            <Image
              source={{ uri: document.uri }}
              className="h-16 w-16 rounded-md"
              resizeMode="cover"
            />
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-md bg-surface">
              <MaterialCommunityIcons
                name="file-document-outline"
                size={32}
                color={theme.extends.colors.text.secondary}
              />
            </View>
          )}

          <View className="ml-3 flex-1">
            <AppText
              weight="medium"
              className="text-sm text-text-primary"
              numberOfLines={1}
            >
              {document.fileName || "Document"}
            </AppText>

            <AppText className="mt-1 text-xs text-text-secondary">
              {isImage ? "Image" : "PDF"}
            </AppText>
          </View>
        </Pressable>

        {showRemove && onRemove && (
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            className="ml-2 h-8 w-8 items-center justify-center"
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={22}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        )}
      </View>

      {isImage && (
        <ImagePreviewModal
          uri={document.uri}
          visible={isPreviewVisible}
          onClose={() => setIsPreviewVisible(false)}
        />
      )}
    </>
  );
}
