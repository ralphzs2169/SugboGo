import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { View } from "react-native";
import { theme } from "@/constants/theme";

const PLACEHOLDER_ICON_SCALE = 0.52;
const PLACEHOLDER_BORDER_WIDTH = 0.5;

type AvatarProps = {
  imageUrl?: string | null;
  size?: number;
};

/**
 * Displays a user's avatar or a placeholder when no image is available.
 */
export default function Avatar({ imageUrl, size = 80 }: AvatarProps) {
  const borderRadius = size / 2;
  const iconSize = size * PLACEHOLDER_ICON_SCALE;

  return (
    <View
      style={{
        width: size,
        height: size,
      }}
    >
      <View
        style={{
          position: "absolute",
          inset: 0,
          borderRadius,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F3F4F6",
          borderWidth: PLACEHOLDER_BORDER_WIDTH,
          borderColor: theme.colors.text.secondary,
        }}
      >
        <MaterialCommunityIcons
          name="account"
          size={iconSize}
          color={theme.colors.text.secondary}
        />
      </View>

      {imageUrl && (
        <Image
          key={imageUrl}
          source={{ uri: imageUrl }}
          style={{
            width: size,
            height: size,
            borderRadius,
          }}
          contentFit="cover"
        />
      )}
    </View>
  );
}
