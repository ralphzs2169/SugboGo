import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type SelectionFieldProps = {
  label: string;
  value?: string;
  placeholder?: string;
  onPress: () => void;
  error?: string;
  disabled?: boolean;
};

/**
 * SelectionField component provides a UI element for selecting an option from a list.
 * It displays a label, the selected value or a placeholder, and an error message if applicable.
 */
export default function SelectionField({
  label,
  value,
  placeholder = "Select",
  onPress,
  error,
  disabled = false,
}: SelectionFieldProps) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-xs font-semibold text-text-secondary">
        {label.toUpperCase()}
      </Text>

      <Pressable
        onPress={onPress}
        disabled={disabled}
        className={`flex-row items-center justify-between rounded-xl border bg-white px-4 py-4 ${
          error ? "border-error" : "border-gray-200"
        }`}
      >
        <Text
          className={`text-base ${
            value ? "text-text-primary" : "text-gray-400"
          }`}
        >
          {value || placeholder}
        </Text>

        <MaterialCommunityIcons name="chevron-down" size={22} color="#9CA3AF" />
      </Pressable>

      {error ? <Text className="mt-1 text-sm text-error">{error}</Text> : null}
    </View>
  );
}
