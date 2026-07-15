import { Text, TouchableOpacity, View } from "react-native";

interface BottomAuthLinkProps {
  text: string;
  actionText: string;
  onPress: () => void;
}

/**
 * BottomAuthLink component provides a link with an action text, typically used at the bottom of authentication forms.
 * @param {string} text - The text displayed before the action link.
 * @param {string} actionText - The text displayed as the action link.
 * @param {() => void} onPress - The function to call when the action link is pressed.
 */
export default function BottomAuthLink({
  text,
  actionText,
  onPress,
}: BottomAuthLinkProps) {
  return (
    <View className="mt-8 flex-row justify-center items-center">
      <Text className="text-body text-text-secondary">{text} </Text>

      <TouchableOpacity onPress={onPress}>
        <Text className="text-body font-bold text-brand">{actionText}</Text>
      </TouchableOpacity>
    </View>
  );
}
