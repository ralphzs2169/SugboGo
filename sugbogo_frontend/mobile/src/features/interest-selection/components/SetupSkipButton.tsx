import { Feather } from "@expo/vector-icons";
import { Text, TouchableOpacity } from "react-native";

interface SetupSkipButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

/**
 * SetupSkipButton displays the secondary action for skipping
 * an optional setup step.
 *
 * @param {() => void} onPress - The function to call when the button is pressed.
 */
export default function SetupSkipButton({
  onPress,
  disabled = false,
}: SetupSkipButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Skip interest selection"
      accessibilityState={{ disabled }}
      className={`min-h-12 self-end flex-row items-center px-2 active:opacity-70 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <Text className="text-body font-semibold text-text-secondary">Skip</Text>

      <Feather
        name="arrow-right"
        size={18}
        color="#666666"
        style={{ marginLeft: 4 }}
      />
    </TouchableOpacity>
  );
}
