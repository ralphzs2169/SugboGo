import { Text, TouchableOpacity } from "react-native";

interface SkipButtonProps {
  onPress: () => void;
}

/**
 * SkipButton provides an option to skip the onboarding flow.
 * @param {() => void} onPress - The function to call when the button is pressed.
 */
export default function SkipButton({ onPress }: SkipButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} className="self-end px-6 py-4">
      <Text className="text-[16px] font-semibold text-[#666666]">Skip</Text>
    </TouchableOpacity>
  );
}
