// shared/components/SafePressable.tsx
import { Pressable, type PressableProps } from "react-native";
import { useIsFocused } from "expo-router";

/**
 * Drop-in Pressable replacement that ignores taps while the screen isn't
 * focused — i.e. while a previous press from this screen is still
 * transitioning away. Unlike a time-based throttle, this doesn't guess
 * a delay: it reflects whether navigation away from here has actually
 * started, so a genuine re-tap after a slow transition is still allowed
 * once the screen becomes focused again on return.
 */
export default function SafePressable({ onPress, ...props }: PressableProps) {
  const isFocused = useIsFocused();

  const handlePress: PressableProps["onPress"] = (event) => {
    if (!isFocused) {
      return;
    }
    onPress?.(event);
  };

  return <Pressable onPress={handlePress} {...props} />;
}
