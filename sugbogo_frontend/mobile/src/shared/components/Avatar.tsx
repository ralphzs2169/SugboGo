import { Image } from "expo-image";
import { View } from "react-native";
import { resolveAvatarSource } from "@/shared/constants/avatars";

type AvatarProps = {
  imageUrl?: string | null;
  avatarKey?: string | null;
  size?: number;
};

/**
 * Displays a user's avatar or a placeholder when no image is available.
 */
export default function Avatar({
  imageUrl,
  avatarKey,
  size = 80,
}: AvatarProps) {
  const borderRadius = size / 2;
  const source = imageUrl ? { uri: imageUrl } : resolveAvatarSource(avatarKey);

  return (
    <View
      style={{
        width: size,
        height: size,
      }}
    >
      <Image
        key={imageUrl ?? avatarKey ?? "default-avatar"}
        source={source}
        style={{
          width: size,
          height: size,
          borderRadius,
        }}
        contentFit="cover"
      />
    </View>
  );
}
