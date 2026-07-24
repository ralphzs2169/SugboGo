import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { useImagePicker } from "../hooks/useImagePicker";
import { useUpdateProfilePicture } from "../hooks/useUpdateProfilePicture";
import { Toast } from "react-native-toast-message/lib/src/Toast";
import { useAuthStore } from "@/features/auth/store/auth.store";

type Props = {
  imageUrl?: string | null;
};

/**
 * ProfileImagePicker component allows users to pick and upload a new profile image.
 * @param {string} imageUrl - The current URL of the user's profile image.
 * @returns {JSX.Element} The rendered ProfileImagePicker component.
 */
export function ProfileImagePicker({ imageUrl }: Props) {
  const { pickImage } = useImagePicker();
  const { uploadProfilePicture, isUploading } = useUpdateProfilePicture();

  async function handlePickImage() {
    let imageUri: string | null = null;

    try {
      imageUri = await pickImage();
    } catch {
      Toast.show({
        type: "error",
        text1: "Unable to Select Image",
        text2: "Please try again.",
      });
      return;
    }

    // If the user cancels the image picker, imageUri will be null.
    // In that case, we simply return without doing anything.
    if (!imageUri) {
      return;
    }

    try {
      await uploadProfilePicture(imageUri);
    } catch (error) {
      const user = useAuthStore.getState().user;

      if (!user) {
        // Session already expired and redirect is happening.
        return;
      }
      Toast.show({
        type: "error",
        text1: "Upload Failed",
        text2: "Unable to update your profile picture. Please try again.",
      });
    }
  }

  return (
    <Pressable onPress={handlePickImage} disabled={isUploading}>
      <View>
        <Image
          source={{
            uri: imageUrl ?? "https://via.placeholder.com/150",
          }}
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
          }}
        />

        {isUploading && (
          <View
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              borderRadius: 60,
              backgroundColor: "rgba(0,0,0,0.35)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
      </View>
    </Pressable>
  );
}
