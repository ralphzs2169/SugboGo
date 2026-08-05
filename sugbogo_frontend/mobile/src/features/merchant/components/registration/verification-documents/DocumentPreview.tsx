import { useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { BusinessDocument } from "@/features/merchant/types/merchantRegistration.types";
import { theme } from "@/constants/theme";
import ImagePreviewModal from "@/shared/components/modals/ImagePreviewModal";

type DocumentPreviewProps = {
  document: BusinessDocument;
  onRemove?: () => void;
  showRemove?: boolean;
};

export default function DocumentPreview({
  document,
  onRemove,
  showRemove = true,
}: DocumentPreviewProps) {
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const isImage = document.mimeType?.startsWith("image/");

  const handlePreview = async () => {
    if (isImage) {
      setIsPreviewVisible(true);
      return;
    }

    await Linking.openURL(document.uri);
  };

  return (
    <>
      <View className="relative flex-row items-center rounded-lg border border-border-primary p-2">
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
            <Text
              className="text-sm font-medium text-text-primary"
              numberOfLines={1}
            >
              {document.fileName || "Document"}
            </Text>

            <Text className="mt-1 text-xs text-text-secondary">
              {isImage ? "Image" : "PDF"}
            </Text>
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
