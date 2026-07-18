import { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface BottomAuthLinkProps {
  text: string;
  actionText: string;
  onPress: () => void;
  icon?: ReactNode;
  marginTop?: number;
}

/**
 * BottomAuthLink component provides a link with an action text, typically used at the bottom of authentication forms.
 * @param {string} text - The text displayed before the action link.
 * @param {string} actionText - The text displayed as the action link.
 * @param {() => void} onPress - The function to call when the action link is pressed.
 * @param {ReactNode} icon - An optional icon displayed beside the action text.
 * @param {number} marginTop - An optional margin top value for spacing.
 *
 */
export default function BottomAuthLink({
  text,
  actionText,
  onPress,
  icon,
  marginTop = 8,
}: BottomAuthLinkProps) {
  return (
    <View className={`mt-${marginTop} flex-row justify-center items-center`}>
      <Text className="text-body text-text-secondary">{text} </Text>
      {icon}
      <TouchableOpacity onPress={onPress}>
        <Text className="text-body font-bold text-brand">{actionText}</Text>
      </TouchableOpacity>
    </View>
  );
}
