import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  View,
} from "react-native";
import * as Sharing from "expo-sharing";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { getApplicationDocumentAccess } from "@/features/merchant/api/merchantApplication.service";
import type { BusinessDocument } from "@/features/merchant/types/registration/registrationOption.types";
import ImagePreviewModal from "@/shared/components/modals/ImagePreviewModal";
import AppText from "@/shared/components/AppText";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

type DocumentPreviewProps = {
  document: BusinessDocument;
  onRemove?: () => void;
  showRemove?: boolean;
  className?: string;
};

/** Opens local files and requests temporary access when a saved document is tapped. */
export default function DocumentPreview({
  document,
  onRemove,
  showRemove = true,
  className = "",
}: DocumentPreviewProps) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const openingRef = useRef<AbortController | null>(null);

  useEffect(() => () => openingRef.current?.abort(), []);

  const isImage = document.mimeType?.startsWith("image/");

  const handlePreview = async () => {
    if (openingRef.current) return;
    const controller = new AbortController();
    openingRef.current = controller;
    setIsOpening(true);

    try {
      if (document.id !== undefined) {
        const { url } = throwOnApiError(
          await getApplicationDocumentAccess(document.id, controller.signal),
        );
        if (controller.signal.aborted) return;

        if (isImage) {
          setPreviewUri(url);
        } else {
          await Linking.openURL(url);
        }
        return;
      }

      const { uri } = document;
      if (isImage) {
        setPreviewUri(uri);
      } else if (/^file:\/\//i.test(uri)) {
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error("Local document handoff is unavailable.");
        }
        await Sharing.shareAsync(uri, {
          mimeType: document.mimeType ?? undefined,
          UTI:
            document.mimeType === "application/pdf"
              ? "com.adobe.pdf"
              : undefined,
          dialogTitle: "Open document with another app",
        });
      } else if (/^(https?:\/\/|content:\/\/)/i.test(uri)) {
        await Linking.openURL(uri);
      } else {
        throw new Error("Unsupported document URI.");
      }
    } catch {
      if (controller.signal.aborted) return;

      Toast.show({
        type: "error",
        text1: "Unable to open document",
        text2:
          document.id === undefined
            ? "This device cannot open the document right now. Try again with a compatible viewer. Your document has not been changed."
            : "Try opening the document again.",
      });
    } finally {
      openingRef.current = null;
      if (!controller.signal.aborted) setIsOpening(false);
    }
  };

  return (
    <>
      <View
        className={`relative flex-row items-center rounded-lg border border-border-primary p-2 ${className}`}
      >
        <Pressable
          onPress={handlePreview}
          disabled={isOpening}
          accessibilityRole="button"
          accessibilityLabel={`Open ${document.fileName || "document"}`}
          accessibilityState={{ busy: isOpening, disabled: isOpening }}
          className="flex-row flex-1 items-center pressed:opacity-70"
        >
          {/* Saved files use an icon until the owner opens the preview. */}
          {isImage && document.id === undefined ? (
            <Image
              source={{ uri: document.uri }}
              className="h-16 w-16 rounded-md"
              resizeMode="cover"
            />
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-md bg-surface">
              <MaterialCommunityIcons
                name={isImage ? "image-outline" : "file-document-outline"}
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
          {isOpening && <ActivityIndicator color={theme.extends.colors.brand} />}
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
          uri={previewUri}
          visible={previewUri !== null}
          onClose={() => setPreviewUri(null)}
        />
      )}
    </>
  );
}
