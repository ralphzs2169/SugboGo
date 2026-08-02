import { Image, Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

type PhotoPreviewProps = {
  uri: string;
  onRemove: () => void;
};

/**
 * Displays a business photo thumbnail with a control for removing it.
 *
 * Provides a larger touch target around the remove action to make it
 * easier to use on mobile devices.
 */
export default function PhotoPreview({ uri, onRemove }: PhotoPreviewProps) {
  return (
    <View className="relative mr-3">
      <Image
        source={{ uri }}
        className="h-24 w-24 rounded-md"
        resizeMode="cover"
      />

      <Pressable
        onPress={onRemove}
        className="absolute -right-2 -top-2 h-7 w-7 items-center justify-center rounded-full bg-surface shadow-sm"
        hitSlop={8}
      >
        <MaterialCommunityIcons
          name="close-circle"
          size={22}
          color={theme.extends.colors.text.secondary}
        />
      </Pressable>
    </View>
  );
}
