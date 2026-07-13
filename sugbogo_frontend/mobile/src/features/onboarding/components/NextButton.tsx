import { Text, TouchableOpacity } from "react-native";

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
      className="mx-6 mt-8 h-14 items-center justify-center rounded-full bg-[#F27F0D]"
    >
      <Text className="text-lg font-semibold text-white">{title}</Text>
    </TouchableOpacity>
  );
}
