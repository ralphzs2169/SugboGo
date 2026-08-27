import { useNavigation } from "expo-router";
import { Pressable, PressableProps } from "react-native";

export default function SafePressable({ onPress, ...props }: PressableProps) {
  const navigation = useNavigation();

  const handlePress: PressableProps["onPress"] = (event) => {
    if (!navigation.isFocused()) {
      return;
    }
    onPress?.(event);
  };

  return <Pressable onPress={handlePress} {...props} />;
}
