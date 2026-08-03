import { Pressable, Text } from "react-native";

type SpecialtyTagProps = {
  label: string;
  isSelected: boolean;
  isDisabled?: boolean;
  onPress?: () => void;
  showDisabledStyle?: boolean;
};

export default function SpecialtyTag({
  label,
  isSelected,
  isDisabled = false,
  onPress,
  showDisabledStyle = true,
}: SpecialtyTagProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled || !onPress}
      className={`mb-2 mr-2 rounded-full border px-3 py-2 ${
        isSelected
          ? "border-brand bg-brand/10"
          : "border-border-primary bg-surface"
      } ${isDisabled && showDisabledStyle ? "opacity-40" : ""}`}
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
