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
    <View className="mt-6 flex-row items-center">
      <Text className="text-[14px] text-[#666]">{text} </Text>

      <TouchableOpacity onPress={onPress}>
        <Text className="text-[14px] font-bold text-[#F27F0D]">
          {actionText}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
