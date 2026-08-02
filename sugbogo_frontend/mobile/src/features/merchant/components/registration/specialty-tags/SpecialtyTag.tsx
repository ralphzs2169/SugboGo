import { Pressable, Text } from "react-native";

type SpecialtyTagProps = {
  label: string;
  isSelected: boolean;
  isDisabled?: boolean;
  onPress: () => void;
};

export default function SpecialtyTag({
  label,
  isSelected,
  isDisabled = false,
  onPress,
}: SpecialtyTagProps) {
  return (
    <Pressable
      onPress={onPress}
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
        {label}
      </Text>
    </Pressable>
  );
}
