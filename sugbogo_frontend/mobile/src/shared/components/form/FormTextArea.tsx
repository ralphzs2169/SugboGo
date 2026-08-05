import { TextInput, TextInputProps } from "react-native";

import InputContainer from "./InputContainer";

interface FormTextAreaProps extends TextInputProps {
  label: string;
  error?: string;
  rightElement?: React.ReactNode;
  required?: boolean;
}

/**
 * FormTextArea renders a multiline text input within an
 * InputContainer.
 *
 * Supports displaying a required indicator alongside the label.
 */
export default function FormTextArea({
  label,
  error,
  rightElement,
  required = false,
  ...props
}: FormTextAreaProps) {
  return (
    <InputContainer
      label={label}
      error={error}
      rightElement={rightElement}
      required={required}
    >
      <TextInput
        multiline
        textAlignVertical="top"
        className="min-h-[120px] flex-1 py-[14px] text-body text-text-primary"
        placeholderTextColor="#999999"
        {...props}
      />
    </InputContainer>
  );
}
