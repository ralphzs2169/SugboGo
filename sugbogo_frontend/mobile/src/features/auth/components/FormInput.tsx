import { TextInput, TextInputProps } from "react-native";

import InputContainer from "./InputContainer";

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
  rightElement?: React.ReactNode;
}

/**
 * FormInput renders a standard text input within an InputContainer.
 */
export default function FormInput({
  label,
  error,
  rightElement,
  ...props
}: FormInputProps) {
  return (
    <InputContainer label={label} error={error} rightElement={rightElement}>
      <TextInput
        className="flex-1 py-[14px] text-body text-text-primary"
        placeholderTextColor="#999999"
        {...props}
      />
    </InputContainer>
  );
}
