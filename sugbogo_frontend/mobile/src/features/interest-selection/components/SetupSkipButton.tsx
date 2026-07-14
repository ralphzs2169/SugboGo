import { Feather } from "@expo/vector-icons";
import { Text, TouchableOpacity } from "react-native";

interface SetupSkipButtonProps {
  onPress: () => void;
}

/**
 * SetupSkipButton displays the secondary action for skipping
 * an optional setup step.
 *
 * @param {() => void} onPress - The function to call when the button is pressed.
 */
export default function SetupSkipButton({ onPress }: SetupSkipButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="self-end flex-row items-center"
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
