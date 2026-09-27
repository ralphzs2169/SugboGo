import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import FullScreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";
import { LayoutAnimation, Platform, Pressable, View } from "react-native";
import { useState } from "react";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { BusinessReview } from "../../../types/review.types";

type Props = {
  reply: NonNullable<BusinessReview["reply"]>;
  perspective?: "explorer" | "merchant";
};

const MAX_LINES = 3;

function formatRelativeDate(dateString: string) {
  const date = new Date(dateString);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

/**
 * Displays the merchant's response as a collapsible continuation of a review.
 *
 * The collapsed state provides a concise response preview while the same
 * section expands in place to reveal the complete merchant response.
 * Response photos can be opened in a fullscreen swipeable gallery.
 */
export default function MerchantReviewResponse({
  reply,
  perspective = "explorer",
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isPhotoViewerVisible, setIsPhotoViewerVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const toggleExpanded = () => {
    if (Platform.OS === "android") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }

    setExpanded((current) => !current);
  };

  const handlePhotoPress = (index: number) => {
    setSelectedPhotoIndex(index);
    setIsPhotoViewerVisible(true);
  };

  const responseLabel =
    perspective === "merchant" ? "Your response" : "From merchant";

  return (
    <>
      <View className="mt-3 rounded-md bg-background px-2">
        <Pressable
          onPress={toggleExpanded}
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? "Collapse owner response" : "Expand owner response"
          }
          className="cursor-pointer active:opacity-70"
        >
          {!expanded ? (
            /* Collapsed response preview */
            <View className="flex-row items-center py-3">
              <AppText
                weight="semibold"
                className="ml-1.5 flex-1 text-xs text-text-secondary"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                <AppText weight="bold" className="text-text-primary">
                  {responseLabel}:
                </AppText>{" "}
                {reply.text}
              </AppText>

              <MaterialCommunityIcons
                name="chevron-down"
                size={18}
                color={theme.extends.colors.text.tertiary}
              />
            </View>
          ) : (
            /* Expanded response */
            <View className="px-2 py-3">
              <View className="flex-row items-center">
                <AppText weight="bold" className="text-xs text-text-primary">
                  {responseLabel}
                </AppText>

                {reply.created_at && (
                  <>
                    <AppText className="mx-1.5 text-[11px] text-text-secondary">
                      ·
                    </AppText>

                    <AppText className="text-[11px] text-text-secondary">
                      {formatRelativeDate(reply.created_at)}
                    </AppText>
                  </>
                )}

                <View className="flex-1" />

                <MaterialCommunityIcons
                  name="chevron-up"
                  size={18}
                  color={theme.extends.colors.text.tertiary}
                />
              </View>

              {/* Response text */}
              <AppText
                className="mt-2 text-sm leading-5 text-text-secondary"
                numberOfLines={isTruncated ? MAX_LINES : undefined}
                onTextLayout={(event) => {
                  setIsTruncated(event.nativeEvent.lines.length > MAX_LINES);
                }}
              >
                {reply.text}
              </AppText>

              {/* Response photos */}
              {reply.photos.length > 0 && (
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {reply.photos.map((photo, index) => (
                    <Pressable
                      key={photo.id}
                      onPress={() => handlePhotoPress(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`View owner response photo ${
                        index + 1
                      }`}
                      className="h-20 w-20 cursor-pointer overflow-hidden rounded-lg bg-surface-secondary active:opacity-90"
                    >
                      <Image
                        source={{ uri: photo.photo_url }}
                        style={{
                          width: "100%",
                          height: "100%",
                        }}
                        contentFit="cover"
                        transition={150}
                      />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}
        </Pressable>
      </View>

      {/* Fullscreen response photo gallery */}
      <FullScreenPhotoViewer
        photos={reply.photos.map((photo) => ({
          uri: photo.photo_url,
        }))}
        visible={isPhotoViewerVisible}
        initialIndex={selectedPhotoIndex}
        onClose={() => setIsPhotoViewerVisible(false)}
        headerContent={
          <View className="ml-3 flex-1 flex-row items-center">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-white/15">
              <MaterialCommunityIcons
                name="storefront-outline"
                size={17}
                color="white"
              />
            </View>

            <View className="ml-2.5 flex-1">
              <AppText
                weight="semibold"
                className="text-sm text-white"
                numberOfLines={1}
              >
                Merchant response
              </AppText>

              {reply.created_at && (
                <AppText className="mt-0.5 text-xs text-white/65">
                  {formatRelativeDate(reply.created_at)}
                </AppText>
              )}
            </View>
          </View>
        }
      />
    </>
  );
}
