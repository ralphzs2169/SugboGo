import { TextInput, TextInputProps } from "react-native";

import InputContainer from "./InputContainer";

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
  ...props
}: FormInputProps) {
  return (
    <InputContainer
      label={label}
      error={error}
      rightElement={rightElement}
      required={required}
    >
      <TextInput
        className="flex-1 py-[14px] text-body text-text-primary"
        placeholderTextColor="#999999"
        {...props}
      />
    </InputContainer>
  );
}
