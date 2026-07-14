import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

interface NextButtonProps {
  title: string;
  onPress: () => void;
}

/**
 * NextButton displays the primary action for progressing through onboarding.
 * @param {string} title - The text displayed on the button.
 * @param {() => void} onPress - The function to call when the button is pressed.
 */
export default function NextButton({ title, onPress }: NextButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="h-12 flex-row items-center justify-center rounded-full bg-brand px-5"
    >
      <View className="flex-row items-center gap-2">
        <Text className="text-base font-semibold text-white">{title}</Text>

        <Ionicons name="arrow-forward" size={18} color="white" />
      </View>
    </TouchableOpacity>
  );
}
