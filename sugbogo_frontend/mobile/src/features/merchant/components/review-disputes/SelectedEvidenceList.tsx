import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";
import FullScreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";

import type { LocalReviewDisputeEvidence } from "../../types/review-disputes/reviewDispute.types";

type Props = {
  evidence: LocalReviewDisputeEvidence[];
  onRemove: (index: number) => void;
  disabled?: boolean;
};

function formatFileSize(bytes?: number) {
  if (bytes === undefined) {
    return null;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Displays selected dispute evidence in a consistent attachment list.
 *
 * Images and documents share the same row layout. Image attachments use a
 * thumbnail preview, while document attachments use a file-type icon.
 * Image thumbnails can be opened in the fullscreen photo viewer.
 */
export default function SelectedEvidenceList({
  evidence,
  onRemove,
  disabled = false,
}: Props) {
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const images = useMemo(
    () =>
      evidence
        .map((item, originalIndex) => ({
          item,
          originalIndex,
        }))
        .filter(({ item }) => item.type === "image"),
    [evidence],
  );

  const openImagePreview = (originalIndex: number) => {
    const imageIndex = images.findIndex(
      (image) => image.originalIndex === originalIndex,
    );

    if (imageIndex === -1) {
      return;
    }

    setPreviewIndex(imageIndex);
    setPreviewVisible(true);
  };

  if (evidence.length === 0) {
    return null;
  }

  return (
    <View className="mt-4 gap-2">
      {/* Selected attachments */}
      {evidence.map((item, index) => {
        const fileSize = formatFileSize(item.fileSize);
        const isImage = item.type === "image";

        return (
          <View
            key={`${item.uri}-${index}`}
            className="min-h-[68px] flex-row items-center rounded-xl border border-border-primary bg-surface px-3 py-2.5"
          >
            {/* Attachment preview */}
            {isImage ? (
              <Pressable
                onPress={() => openImagePreview(index)}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${item.fileName}`}
                className="h-12 w-12 cursor-pointer overflow-hidden rounded-lg bg-surface-secondary active:opacity-80"
              >
                <Image
                  source={{ uri: item.uri }}
                  contentFit="cover"
                  transition={150}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                />
              </Pressable>
            ) : (
              <View className="h-12 w-12 items-center justify-center rounded-lg bg-brand/10">
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={24}
                  color={theme.extends.colors.brand}
                />
              </View>
            )}

            {/* Attachment details */}
            <View className="ml-3 min-w-0 flex-1">
              <Text
                numberOfLines={1}
                className="text-sm font-semibold text-text-primary"
              >
                {item.fileName}
              </Text>

              <Text className="mt-1 text-xs text-text-secondary">
                {isImage ? "Image" : "Document"}
                {fileSize ? ` · ${fileSize}` : ""}
              </Text>
            </View>

            {/* Remove attachment */}
            <Pressable
              onPress={() => onRemove(index)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.fileName}`}
              hitSlop={8}
              className={`ml-3 h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-surface-secondary active:opacity-70 ${
                disabled ? "opacity-50" : ""
              }`}
            >
              <MaterialCommunityIcons
                name="close"
                size={18}
                color={theme.extends.colors.text.secondary}
              />
            </Pressable>
          </View>
        );
      })}

      {/* Fullscreen image viewer */}
      <FullScreenPhotoViewer
        photos={images.map(({ item }) => ({
          uri: item.uri,
        }))}
        visible={previewVisible}
        initialIndex={previewIndex}
        onClose={() => setPreviewVisible(false)}
      />
    </View>
  );
}
