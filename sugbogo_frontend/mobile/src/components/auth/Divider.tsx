import { Text, View } from "react-native";

interface DividerProps {
  text: string;
}

/**
 * Divider component provides a horizontal line with centered text, typically used to separate sections in a form.
 * @param {string} text - The text to display in the center of the divider.
 */
export default function Divider({ text }: DividerProps) {
  return (
    <View className="mb-8 flex-row items-center">
      <View className="h-px flex-1 bg-gray-200" />

      <Text className="mx-3 text-[11px] font-semibold tracking-[0.5px] text-[#999]">
        {text}
      </Text>

      <View className="h-px flex-1 bg-gray-200" />
    </View>
  );
}
