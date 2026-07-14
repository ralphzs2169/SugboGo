/**
 * InterestTag component renders a single selectable tag/chip.
 * Used inside InterestGrid to represent individual MSME specialty categories.
 *
 **/

import { Text, TouchableOpacity } from "react-native";

interface InterestTagProps {
  /** The label text displayed inside the tag */
  label: string;
  /** Whether this tag is currently selected */
  isSelected: boolean;
  /** Callback when the tag is pressed */
  onPress: () => void;
}

export default function InterestTag({
  label,
  isSelected,
  onPress,
}: InterestTagProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`m-1 rounded-tag border px-4 py-2 ${
        isSelected ? "border-brand bg-brand" : "border-disabled bg-white"
      }`}
    >
      <Text
        className={`text-body font-medium ${
          isSelected ? "text-white" : "text-text-primary"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
