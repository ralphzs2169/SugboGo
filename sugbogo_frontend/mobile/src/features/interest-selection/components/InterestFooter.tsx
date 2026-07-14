import { Feather } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

interface InterestFooterProps {
  hasMinSelection: boolean;
  onPress: () => void;
}

/**
 * InterestFooter displays the primary action button for completing
 * the interest selection flow.
 *
 * The button remains disabled until the minimum number of interests
 * has been selected.
 *
 * @param {boolean} hasMinSelection - Whether the user has selected the minimum required interests.
 * @param {() => void} onPress - The function to call when the button is pressed.
 */
export default function InterestFooter({
  hasMinSelection,
  onPress,
}: InterestFooterProps) {
  return (
    <View className="px-6 pb-8 pt-4">
      <TouchableOpacity
        className={`flex-row items-center justify-center rounded-btn py-4 ${
          hasMinSelection ? "bg-brand" : "bg-disabled"
        }`}
        onPress={onPress}
        disabled={!hasMinSelection}
      >
        <Text
          className={`mr-2 text-body font-bold ${
            hasMinSelection ? "text-white" : "text-placeholder"
          }`}
        >
          Start Exploring
        </Text>

        <Feather
          name="arrow-right"
          size={18}
          color={hasMinSelection ? "#FFFFFF" : "#999999"}
        />
      </TouchableOpacity>
    </View>
  );
}
