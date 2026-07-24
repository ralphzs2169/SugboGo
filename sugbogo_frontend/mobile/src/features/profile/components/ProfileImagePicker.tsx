import { Pressable } from "react-native";
import { useImagePicker } from "../hooks/useImagePicker";
import { Toast } from "react-native-toast-message/lib/src/Toast";
import Avatar from "@/shared/components/Avatar";
import { useActionSheet } from "@expo/react-native-action-sheet";

type Props = {
  imageUrl?: string | null;
  hasCustomProfilePicture: boolean;
  onImageSelected?: (imageUri: string) => void;
  onRemovePicture?: () => void;
};

/**
 * ProfileImagePicker component allows users to pick and upload a new profile image.
 */
export function ProfileImagePicker({
  imageUrl,
  hasCustomProfilePicture,
  onImageSelected,
  onRemovePicture,
}: Props) {
  const { showActionSheetWithOptions } = useActionSheet();
  const { pickFromGallery, takePhoto } = useImagePicker();

  // Handles the image selection process, allowing users to choose an image from the gallery,
  // take a new photo, or remove the current profile picture.
  async function handlePickImage() {
    const options = ["Choose Photo", "Take Photo"];

    if (hasCustomProfilePicture) {
      options.push("Remove Current Photo");
    }

    options.push("Cancel");

    const removeIndex = options.indexOf("Remove Current Photo");
    const cancelIndex = options.indexOf("Cancel");

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: cancelIndex,
        destructiveButtonIndex: removeIndex !== -1 ? removeIndex : undefined,
      },
      async (selectedIndex) => {
        try {
          if (selectedIndex === undefined) {
            return;
          }

          const selectedOption = options[selectedIndex];
          let imageUri: string | null = null;

          switch (selectedOption) {
            case "Choose Photo":
              imageUri = await pickFromGallery();
              break;

            case "Take Photo":
              imageUri = await takePhoto();
              break;

            case "Remove Current Photo":
              onRemovePicture?.();
              return;

            default:
              return;
          }

          if (!imageUri) {
            return;
          }

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
      <Avatar imageUrl={imageUrl} size={120} />
    </Pressable>
  );
}
