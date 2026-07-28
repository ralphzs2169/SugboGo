import { TextInput, TextInputProps } from "react-native";
import InputContainer from "./InputContainer";

interface FormTextAreaProps extends TextInputProps {
  label: string;
  error?: string;
  rightElement?: React.ReactNode;
}

/**
 * FormTextArea renders a multiline text input within an
 * InputContainer.
 */
export default function FormTextArea({
  label,
  error,
  rightElement,
  ...props
}: FormTextAreaProps) {
  return (
    <InputContainer label={label} error={error} rightElement={rightElement}>
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
