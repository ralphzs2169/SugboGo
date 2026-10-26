import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";
import { resolveAvatarSource } from "@/shared/constants/avatars";

type AvatarProps = {
  imageUrl?: string | null;
  avatarKey?: string | null;
  size?: number;
};

/** Owns failure state for one supplied avatar URL. */
function AvatarImage({
  imageUrl,
  avatarKey,
  size = 80,
}: AvatarProps) {
  const [hasFailedImage, setHasFailedImage] = useState(false);

  const borderRadius = size / 2;
  const remoteImageUrl = hasFailedImage ? null : imageUrl;
  const source = remoteImageUrl
    ? { uri: remoteImageUrl }
    : resolveAvatarSource(avatarKey);

  return (
    <Image
      source={source}
      style={{
        width: size,
        height: size,
        borderRadius,
      }}
      contentFit="cover"
      onError={remoteImageUrl ? () => setHasFailedImage(true) : undefined}
    />
  );
}

/** Displays an avatar, falling back to a built-in avatar if loading fails. */
export default function Avatar({
  imageUrl,
  avatarKey,
  size = 80,
}: AvatarProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
      }}
    >
      <AvatarImage
        key={imageUrl ?? "default-avatar"}
        imageUrl={imageUrl}
        avatarKey={avatarKey}
        size={size}
      />
    </View>
  );
}
