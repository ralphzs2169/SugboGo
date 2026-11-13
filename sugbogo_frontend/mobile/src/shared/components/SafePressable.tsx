import { useNavigation } from "expo-router";
import { Pressable, type PressableProps, type View } from "react-native";
import type { Ref } from "react";

export default function SafePressable({
  onPress,
  ref,
  ...props
}: PressableProps & { ref?: Ref<View> }) {
  const navigation = useNavigation();

  const handlePress: PressableProps["onPress"] = (event) => {
    if (!navigation.isFocused()) {
      return;
    }

    onPress?.(event);
  };

  return <Pressable ref={ref} onPress={handlePress} {...props} />;
}
