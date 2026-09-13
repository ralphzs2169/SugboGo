import AppText from "@/shared/components/AppText";
import { ReactNode } from "react";
import { TouchableOpacity, View } from "react-native";

interface BottomAuthLinkProps {
  text: string;
  actionText: string;
  onPress: () => void;
  icon?: ReactNode;
  marginTop?: number;
}

/**
 * BottomAuthLink component provides a link with an action text, typically used at the bottom of authentication forms.

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
      <AppText className="text-body text-text-secondary">{text} </AppText>
      {icon}
      <TouchableOpacity onPress={onPress}>
        <AppText weight="bold" className="text-body  text-brand">
          {actionText}
        </AppText>
      </TouchableOpacity>
    </View>
  );
}
