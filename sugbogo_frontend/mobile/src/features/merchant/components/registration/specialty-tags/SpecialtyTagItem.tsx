import { Pressable, Text } from "react-native";

import type { SpecialtyTagOption } from "@/features/merchant/types/merchantRegistration.types";

type Props = {
  tag: SpecialtyTagOption;
  isSelected: boolean;
  isDisabled: boolean;
  onPress: () => void;
};

/**
 * Renders an individual specialty tag option.
 *
 * Displays the selected state and prevents interaction when
 * the maximum number of tags has already been selected.
 */
export default function SpecialtyTagItem({
  tag,
  isSelected,
  isDisabled,
  onPress,
}: Props) {
  function handlePress() {
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      className={`mb-2 mr-2 rounded-full border px-3 py-2 ${
        isSelected
          ? "border-brand bg-brand/10"
          : "border-border-primary bg-surface"
      } ${isDisabled ? "opacity-40" : ""}`}
    >
      <Text
        className={`text-sm font-medium ${
          isSelected ? "text-brand" : "text-text-secondary"
        }`}
      >
        {tag.name}
      </Text>
    </Pressable>
  );
}
