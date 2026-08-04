import { useState } from "react";
import { Image, Modal, Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { theme } from "@/constants/theme";

type PhotoPreviewProps = {
  uri: string;
  onRemove?: () => void;
};

/**
 * Displays a business photo thumbnail.
 *
 * Tapping the thumbnail opens a fullscreen preview.
 * The remove action is optional so the component can be
 * reused in read-only contexts such as the review screen.
 */
export default function PhotoPreview({ uri, onRemove }: PhotoPreviewProps) {
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  return (
    <>
      <View className="relative mr-3">
        <Pressable
          onPress={() => setIsPreviewVisible(true)}
          className="rounded-md pressed:opacity-70"
        >
          <Image
            source={{ uri }}
            className="h-24 w-24 rounded-md"
            resizeMode="cover"
          />
        </Pressable>

        {onRemove && (
          <Pressable
            onPress={onRemove}
            className="absolute -right-2 -top-2 h-7 w-7 items-center justify-center rounded-full bg-surface shadow-sm"
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={22}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        )}
      </View>

      <Modal
        visible={isPreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPreviewVisible(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/80"
          onPress={() => setIsPreviewVisible(false)}
        >
          <Pressable onPress={(event) => event.stopPropagation()}>
            <Image
              source={{ uri }}
              className="h-[80vh] w-[90vw]"
              resizeMode="contain"
            />
          </Pressable>

          <Pressable
            onPress={() => setIsPreviewVisible(false)}
            hitSlop={10}
            className="absolute right-5 top-12 h-10 w-10 items-center justify-center"
          >
            <MaterialCommunityIcons name="close" size={28} color="white" />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
