import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import { Toast } from "react-native-toast-message/lib/src/Toast";

import Avatar from "@/shared/components/Avatar";
import type { AvatarKey } from "@/shared/constants/avatars";

import { useImagePicker } from "../hooks/useImagePicker";
import { ProfilePictureBottomSheet } from "./edit-profile/ProfilePictureBottomSheet";

type Props = {
  imageUrl?: string | null;
  avatarKey?: AvatarKey | null;
  isShowingCustomProfilePicture: boolean;
  isSaving: boolean;
  onImageSelected?: (imageUri: string) => void;
  onChooseAvatar?: () => void;
  onRemovePicture?: () => void;
};

/**
 * Handles profile picture selection and related user interactions.
 *
 * Prevents additional picture actions throughout the profile save.
 */
export function ProfileImagePicker({
  imageUrl,
  avatarKey,
  isShowingCustomProfilePicture,
  isSaving,
  onImageSelected,
  onChooseAvatar,
  onRemovePicture,
}: Props) {
  const { pickFromGallery } = useImagePicker();

  const sheetRef = useRef<BottomSheetModal | null>(null);

  useEffect(() => {
    if (isSaving) {
      sheetRef.current?.dismiss();
    }
  }, [isSaving]);

  // Open picture actions
  function handlePickImage() {
    if (isSaving) {
      return;
    }

    sheetRef.current?.present();
  }

  // Choose from gallery
  async function handleChoosePhoto() {
    if (isSaving) {
      return;
    }

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

  // Remove current picture
  function handleRemovePicture() {
    if (isSaving) {
      return;
    }

    sheetRef.current?.dismiss();
    onRemovePicture?.();
  }

  return (
    <>
      {/* Avatar trigger */}
      <Pressable
        onPress={handlePickImage}
        disabled={isSaving}
        accessibilityRole="button"
        accessibilityLabel="Change avatar"
        accessibilityState={{ disabled: isSaving, busy: isSaving }}
        className="cursor-pointer active:opacity-80 disabled:opacity-100"
      >
        <View className="relative">
          <View className="rounded-full border border-white">
            <Avatar imageUrl={imageUrl} avatarKey={avatarKey} size={120} />
          </View>
        </View>
      </Pressable>

      {/* Picture actions */}
      <ProfilePictureBottomSheet
        sheetRef={sheetRef}
        isShowingCustomProfilePicture={isShowingCustomProfilePicture}
        onChooseAvatar={() => {
          if (isSaving) {
            return;
          }

          sheetRef.current?.dismiss();
          onChooseAvatar?.();
        }}
        onChoosePhoto={handleChoosePhoto}
        onRemovePicture={handleRemovePicture}
      />
    </>
  );
}
