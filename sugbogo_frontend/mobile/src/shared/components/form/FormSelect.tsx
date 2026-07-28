import { Pressable, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import InputContainer from "./InputContainer";

type FormSelectProps = {
  label: string;
  value?: string;
  placeholder?: string;
  onPress: () => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  rightElement?: React.ReactNode;
};

/**
 * FormSelect renders a pressable selection field within an InputContainer.
 *
 * Used for fields that open a picker, bottom sheet, or modal
 * instead of accepting free-text input.
 */
export default function FormSelect({
  label,
  value,
  placeholder = "Select",
  onPress,
  error,
  disabled = false,
  required = false,
  rightElement,
}: FormSelectProps) {
  return (
    <InputContainer
      label={label}
      error={error}
      rightElement={rightElement}
      required={required}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        className="flex-1 flex-row items-center justify-between py-[14px]"
      >
        <Text
          className={`text-body ${
            value ? "text-text-primary" : "text-text-secondary"
          }`}
        >
          {value || placeholder}
        </Text>

        <MaterialCommunityIcons name="chevron-down" size={20} color="#999999" />
      </Pressable>
    </InputContainer>
  );
}
