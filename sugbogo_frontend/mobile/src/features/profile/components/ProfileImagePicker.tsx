import { useRef } from "react";
import { Pressable, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Toast } from "react-native-toast-message/lib/src/Toast";

import Avatar from "@/shared/components/Avatar";

import { useImagePicker } from "../hooks/useImagePicker";
import { ProfilePictureBottomSheet } from "./edit-profile/ProfilePictureBottomSheet";

type Props = {
  imageUrl?: string | null;
  isShowingCustomProfilePicture: boolean;
  hasSelectedImage: boolean;
  onImageSelected?: (imageUri: string) => void;
  onRemovePicture?: () => void;
};

/**
 * ProfileImagePicker handles profile picture interactions.
 *
 * This component displays the user's avatar and provides actions for
 * selecting a new image from the gallery, taking a photo, or removing
 * the current profile picture.
 *
 * Image processing and uploading are handled by the parent component.
 * This component only manages image selection and user interactions.
 */
export function ProfileImagePicker({
  imageUrl,
  isShowingCustomProfilePicture,
  hasSelectedImage,
  onImageSelected,
  onRemovePicture,
}: Props) {
  const { pickFromGallery, takePhoto } = useImagePicker();

  const sheetRef = useRef<BottomSheetModal | null>(null);

  // Opens the profile picture action bottom sheet.
  function handlePickImage() {
    sheetRef.current?.present();
  }

  // Opens the device gallery and returns the selected image URI.
  async function handleChoosePhoto() {
    try {
      const imageUri = await pickFromGallery();

      if (!imageUri) {
        return;
      }

      onImageSelected?.(imageUri);
    } catch (error) {
      console.error("Gallery selection failed:", error);

      Toast.show({
        type: "error",
        text1: "Image Error",
        text2: "Unable to select this image. Please try another one.",
      });
    }
  }

  //  Opens the device camera and returns the captured image URI.
  async function handleTakePhoto() {
    try {
      const imageUri = await takePhoto();

      if (!imageUri) {
        return;
      }

      onImageSelected?.(imageUri);
    } catch (error) {
      console.error("Camera capture failed:", error);

      Toast.show({
        type: "error",
        text1: "Image Error",
        text2: "Unable to capture this image. Please try again.",
      });
    }
  }

  //Removes the current profile picture after dismissing the bottom sheet.
  function handleRemovePicture() {
    sheetRef.current?.dismiss();

    onRemovePicture?.();
  }

  return (
    <>
      <Pressable onPress={handlePickImage} className="active:opacity-80">
        <View className="relative">
          <View className="rounded-full border-1 border-white">
            <Avatar imageUrl={imageUrl} size={120} />
          </View>
        </View>
      </Pressable>

      <ProfilePictureBottomSheet
        sheetRef={sheetRef}
        isShowingCustomProfilePicture={isShowingCustomProfilePicture}
        hasSelectedImage={hasSelectedImage}
        onChoosePhoto={handleChoosePhoto}
        onTakePhoto={handleTakePhoto}
        onRemovePicture={handleRemovePicture}
      />
    </>
  );
}
