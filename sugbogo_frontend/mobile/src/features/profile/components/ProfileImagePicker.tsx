import { Image, Pressable, View } from "react-native";
import { useImagePicker } from "../hooks/useImagePicker";
import { Toast } from "react-native-toast-message/lib/src/Toast";
import { useState } from "react";

type Props = {
  imageUrl?: string | null;
  onImageSelected?: (imageUri: string) => void;
};

/**
 * ProfileImagePicker component allows users to pick and upload a new profile image.
 */
export function ProfileImagePicker({ imageUrl, onImageSelected }: Props) {
  const { pickImage } = useImagePicker();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  async function handlePickImage() {
    let imageUri: string | null = null;

    try {
      imageUri = await pickImage();
    } catch (error) {
      console.error("Image selection failed:", error);
      Toast.show({
        type: "error",
        text1: "Image Error",
        text2: "Unable to process this image. Please try another one.",
      });
      return;
    }

    // If the user cancels the image picker, imageUri will be null.
    // In that case, we simply return without doing anything.
    if (!imageUri) {
      return;
    }

    // Update the selected image state and notify the parent component
    setSelectedImage(imageUri);
    onImageSelected?.(imageUri);
  }

  return (
    <Pressable onPress={handlePickImage}>
      <View>
        <Image
          source={{
            uri: selectedImage ?? imageUrl ?? "https://via.placeholder.com/150",
          }}
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
          }}
        />
      </View>
    </Pressable>
  );
}
