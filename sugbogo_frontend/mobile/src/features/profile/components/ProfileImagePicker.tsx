import { Pressable, Image } from "react-native";

import { useImagePicker } from "../hooks/useImagePicker";
import { useUpdateProfilePicture } from "../hooks/useUpdateProfilePicture";

type Props = {
  imageUrl?: string | null;
};

export function ProfileImagePicker({ imageUrl }: Props) {
  const { pickImage } = useImagePicker();
  const { uploadProfilePicture, isUploading } = useUpdateProfilePicture();

  async function handlePickImage() {
    const imageUri = await pickImage();

    if (!imageUri) {
      return;
    }

    await uploadProfilePicture(imageUri);
  }

  return (
    <Pressable onPress={handlePickImage} disabled={isUploading}>
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
    </Pressable>
  );
}
