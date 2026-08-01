import { TextInput, TextInputProps } from "react-native";

import InputContainer from "./InputContainer";
import { theme } from "@/constants/theme";

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
  rightElement?: React.ReactNode;
  required?: boolean;
}

/**
 * FormInput renders a standard text input within an InputContainer.
 */
export default function FormInput({
  label,
  error,
  rightElement,
  required = false,
  editable = true,
  ...props
}: FormInputProps) {
  return (
    <InputContainer
      label={label}
      error={error}
      rightElement={rightElement}
      required={required}
      editable={editable}
    >
      <TextInput
        className={`flex-1 py-[14px] text-body ${
          editable ? "text-text-primary" : "text-text-secondary"
        }`}
        placeholderTextColor={
          editable
            ? theme.extends.colors.text.tertiary
            : theme.extends.colors.text.disabled
        }
        editable={editable}
        {...props}
      />
    </InputContainer>
  );
}
