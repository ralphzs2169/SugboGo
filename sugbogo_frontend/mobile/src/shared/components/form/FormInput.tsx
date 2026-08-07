import { TextInput, TextInputProps } from "react-native";

import { theme } from "@/constants/theme";
import InputContainer from "./InputContainer";

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
  rightElement?: React.ReactNode;
  required?: boolean;
  helperText?: string;
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
  helperText,
  ...props
}: FormInputProps) {
  return (
    <InputContainer
      label={label}
      error={error}
      rightElement={rightElement}
      required={required}
      editable={editable}
      helperText={helperText}
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
