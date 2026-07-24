import { Pressable, View } from "react-native";
import { useImagePicker } from "../hooks/useImagePicker";
import { Toast } from "react-native-toast-message/lib/src/Toast";
import Avatar from "@/shared/components/Avatar";
import { useActionSheet } from "@expo/react-native-action-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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
    <Pressable onPress={handlePickImage} className="active:opacity-80">
      <View className="relative">
        {/* Avatar */}
        <View className="rounded-full border-1 border-white">
          <Avatar imageUrl={imageUrl} size={120} />
        </View>

        {/* Camera button */}
        <View className=" absolute bottom-0 right-0 h-10 w-10 items-center justify-center rounded-full border-1border-white">
          <MaterialCommunityIcons name="camera" size={20} color="white" />
        </View>
      </View>
    </Pressable>
  );
}
