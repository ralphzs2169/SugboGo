import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, Modal, Pressable, View } from "react-native";

type ImagePreviewModalProps = {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
};

/**
 * Displays an image in a centered modal preview.
 *
 * The backdrop fills the screen, while the image is constrained
 * to the available space and keeps its original aspect ratio.
 */
export default function ImagePreviewModal({
  uri,
  visible,
  onClose,
}: ImagePreviewModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/80">
        <Pressable onPress={onClose} className="absolute inset-0" />

        <Pressable
          onPress={() => {}}
          className="h-[85%] w-[90%] items-center justify-center"
        >
          {uri && (
            <Image
              source={{ uri }}
              className="h-full w-full"
              resizeMode="contain"
            />
          )}
        </Pressable>

        <Pressable
          onPress={onClose}
          hitSlop={8}
          className="absolute right-5 top-12 z-10 h-10 w-10 items-center justify-center"
        >
          <MaterialCommunityIcons name="close" size={28} color="white" />
        </Pressable>
      </View>
    </Modal>
  );
}
