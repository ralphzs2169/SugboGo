import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Linking, Pressable, View } from "react-native";
import { useState } from "react";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import FullScreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";

import EvidencePickerActions from "../EvidencePickerActions";
import type { ReviewDisputeEvidence } from "../../../types/review-disputes/reviewDispute.types";

type Props = {
  evidence: ReviewDisputeEvidence[];
  isPending: boolean;
  remainingSlots: number;
  isAddingEvidence: boolean;
  isDeletingEvidence: boolean;
  isPickingImages: boolean;
  isPickingDocuments: boolean;
  onPickImages: () => void;
  onPickDocuments: () => void;
  onRequestDelete: (evidence: ReviewDisputeEvidence) => void;
};

/**
 * Displays submitted dispute evidence and available evidence-management actions.
 *
 * Image evidence opens in the application's fullscreen photo viewer, while
 * document evidence opens externally. Pending disputes also support attachment
 * uploads and evidence removal.
 */
export default function ReviewDisputeEvidenceSection({
  evidence,
  isPending,
  remainingSlots,
  isAddingEvidence,
  isDeletingEvidence,
  isPickingImages,
  isPickingDocuments,
  onPickImages,
  onPickDocuments,
  onRequestDelete,
}: Props) {
  const [isPhotoViewerVisible, setIsPhotoViewerVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const evidenceCount = evidence.length;

  const imageEvidence = evidence.filter((item) => item.type === "image");

  const openEvidence = (item: ReviewDisputeEvidence) => {
    if (item.type === "image") {
      const imageIndex = imageEvidence.findIndex(
        (image) => image.id === item.id,
      );

      if (imageIndex >= 0) {
        setSelectedPhotoIndex(imageIndex);
        setIsPhotoViewerVisible(true);
      }

      return;
    }

    void Linking.openURL(item.url);
  };

  return (
    <>
      <View>
        {/* Evidence summary */}
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <AppText weight="semibold" className="text-sm text-text-primary">
              {evidenceCount} {evidenceCount === 1 ? "file" : "files"} attached
            </AppText>

            {isPending && (
              <AppText className="mt-0.5 text-xs text-text-secondary">
                {remainingSlots} {remainingSlots === 1 ? "slot" : "slots"}{" "}
                remaining
              </AppText>
            )}
          </View>
        </View>

        {/* Evidence files */}
        {evidenceCount === 0 ? (
          <View className="items-center rounded-xl border border-dashed border-border-primary bg-surface-secondary px-5 py-7">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-surface">
              <MaterialCommunityIcons
                name="file-plus-outline"
                size={23}
                color={theme.extends.colors.text.tertiary}
              />
            </View>

            <AppText
              weight="semibold"
              className="mt-3 text-sm text-text-primary"
            >
              No evidence added
            </AppText>

            {isPending && (
              <AppText className="mt-1 text-center text-xs leading-5 text-text-secondary">
                Add photos or documents that support your dispute.
              </AppText>
            )}
          </View>
        ) : (
          <View className="gap-2.5">
            {evidence.map((item) => (
              <View
                key={item.id}
                className="flex-row items-center rounded-xl border border-border-primary bg-surface px-3 py-3"
              >
                {/* Evidence file */}
                <Pressable
                  onPress={() => openEvidence(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.file_name ?? "evidence"}`}
                  className="min-w-0 flex-1 cursor-pointer flex-row items-center active:opacity-70"
                >
                  {item.type === "image" ? (
                    <Image
                      source={{ uri: item.url }}
                      contentFit="cover"
                      transition={150}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 10,
                      }}
                    />
                  ) : (
                    <View className="h-[52px] w-[52px] items-center justify-center rounded-xl bg-brand/10">
                      <MaterialCommunityIcons
                        name="file-document-outline"
                        size={25}
                        color={theme.extends.colors.brand}
                      />
                    </View>
                  )}

                  <View className="ml-3 min-w-0 flex-1">
                    <AppText
                      weight="semibold"
                      className="text-sm text-text-primary"
                      numberOfLines={1}
                    >
                      {item.file_name ?? "Evidence file"}
                    </AppText>

                    <View className="mt-1 flex-row items-center">
                      <AppText className="text-xs capitalize text-text-secondary">
                        {item.type}
                      </AppText>

                      <View className="mx-2 h-1 w-1 rounded-full bg-text-tertiary" />

                      <AppText className="text-xs text-text-secondary">
                        Evidence
                      </AppText>
                    </View>
                  </View>
                </Pressable>

                {/* Evidence actions */}
                <View className="ml-2 flex-row items-center">
                  <Pressable
                    onPress={() => openEvidence(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${item.file_name ?? "evidence"}`}
                    className="h-9 w-9 cursor-pointer items-center justify-center rounded-full active:bg-surface-secondary"
                  >
                    <MaterialCommunityIcons
                      name={
                        item.type === "image" ? "arrow-expand" : "open-in-new"
                      }
                      size={18}
                      color={theme.extends.colors.text.secondary}
                    />
                  </Pressable>

                  {isPending && (
                    <Pressable
                      onPress={() => onRequestDelete(item)}
                      disabled={isDeletingEvidence}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${
                        item.file_name ?? "evidence"
                      }`}
                      className="ml-1 h-9 w-9 cursor-pointer items-center justify-center rounded-full active:bg-red-50 disabled:opacity-50"
                    >
                      <MaterialCommunityIcons
                        name="delete-outline"
                        size={19}
                        color={theme.extends.colors.error}
                      />
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Evidence upload actions */}
        {isPending && (
          <View className="mt-4">
            <EvidencePickerActions
              remainingSlots={remainingSlots}
              disabled={isAddingEvidence}
              isPickingImages={isPickingImages}
              isPickingDocuments={isPickingDocuments}
              onPickImages={onPickImages}
              onPickDocuments={onPickDocuments}
            />

            <AppText className="mt-3 text-center text-xs text-text-tertiary">
              Up to 5 files · Maximum 10 MB each
            </AppText>
          </View>
        )}
      </View>

      {/* Fullscreen evidence gallery */}
      <FullScreenPhotoViewer
        photos={imageEvidence.map((item) => ({
          uri: item.url,
        }))}
        visible={isPhotoViewerVisible}
        initialIndex={selectedPhotoIndex}
        onClose={() => setIsPhotoViewerVisible(false)}
        headerContent={
          <View className="flex-1">
            <AppText
              weight="semibold"
              className="text-sm text-white"
              numberOfLines={1}
            >
              {imageEvidence[selectedPhotoIndex]?.file_name ?? "Evidence photo"}
            </AppText>

            <AppText className="mt-0.5 text-xs text-white/65">
              Dispute evidence
            </AppText>
          </View>
        }
      />
    </>
  );
}
