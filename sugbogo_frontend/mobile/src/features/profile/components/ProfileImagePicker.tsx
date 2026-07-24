import { Pressable } from "react-native";
import { useImagePicker } from "../hooks/useImagePicker";
import { Toast } from "react-native-toast-message/lib/src/Toast";
import { useState, useEffect } from "react";
import Avatar from "@/shared/components/Avatar";
import { useActionSheet } from "@expo/react-native-action-sheet";

type Props = {
  imageUrl?: string | null;
  onImageSelected?: (imageUri: string) => void;
  onRemovePicture?: () => void;
};

/**
 * ProfileImagePicker component allows users to pick and upload a new profile image.
 */
export function ProfileImagePicker({
  imageUrl,
  onImageSelected,
  onRemovePicture,
}: Props) {
  const { showActionSheetWithOptions } = useActionSheet();
  const { pickFromGallery, takePhoto } = useImagePicker();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedImage(null);
  }, [imageUrl]);

  async function handlePickImage() {
    showActionSheetWithOptions(
      {
        options: [
          "Choose Photo",
          "Take Photo",
          "Remove Current Photo",
          "Cancel",
        ],
        cancelButtonIndex: 3,
        destructiveButtonIndex: 2,
      },
      async (selectedIndex) => {
        try {
          let imageUri: string | null = null;

          switch (selectedIndex) {
            case 0:
              imageUri = await pickFromGallery();
              break;

            case 1:
              imageUri = await takePhoto();
              break;

            case 2:
              onRemovePicture?.();
              return;

            default:
              return;
          }

          if (!imageUri) {
            return;
          }

          setSelectedImage(imageUri);
          onImageSelected?.(imageUri);
          console.log("Selected image:", imageUri);
        } catch (error) {
          console.error("Image selection failed:", error);

          Toast.show({
            type: "error",
            text1: "Image Error",
            text2: "Unable to process this image. Please try another one.",
          });
        }
      },
    );
  }

  return (
    <Pressable onPress={handlePickImage}>
      <Avatar imageUrl={selectedImage ?? imageUrl} size={120} />
    </Pressable>
  );
}
