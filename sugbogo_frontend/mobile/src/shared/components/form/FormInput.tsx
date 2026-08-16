import { TextInput, TextInputProps, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { theme } from "@/constants/theme";
import InputContainer from "./InputContainer";

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
  rightElement?: React.ReactNode;
  required?: boolean;
  helperText?: string;
  minLength?: number;
  showCharacterCount?: boolean;
}

/**
 * FormInput renders a standard text input within an InputContainer.
 *
 * Supports optional live minimum-length feedback while keeping
 * form validation errors controlled by the form validation layer.
 */
export default function FormInput({
  label,
  error,
  rightElement,
  required = false,
  editable = true,
  helperText,
  minLength,
  showCharacterCount = false,
  value,
  ...props
}: FormInputProps) {
  const characterCount = value?.trim().length ?? 0;

  const isValid =
    !error && minLength !== undefined && characterCount >= minLength;

  const showCounter = showCharacterCount && minLength !== undefined;

  const feedback = (
    <View className="mt-1 flex-row items-start gap-2">
      {/* Error or helper message */}
      <View className="min-w-0 flex-1">
        {error ? (
          <Text className="text-xs font-medium text-text-error">{error}</Text>
        ) : helperText ? (
          <Text className="text-xs text-text-secondary">{helperText}</Text>
        ) : null}
      </View>

      {/* Minimum-length counter */}
      {showCounter && (
        <View className="shrink-0 flex-row items-center gap-1">
          {isValid && (
            <View className="h-4 w-4 items-center justify-center rounded-full bg-success">
              <MaterialCommunityIcons
                name="check"
                size={10}
                color={theme.extends.colors.background}
              />
            </View>
          )}

          <Text
            className={`text-xs ${
              isValid ? "text-success" : "text-text-secondary"
            }`}
          >
            {characterCount}/{minLength}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <InputContainer
      label={label}
      error={error}
      rightElement={rightElement}
      required={required}
      editable={editable}
      bottomElement={feedback}
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
        value={value}
        {...props}
      />
    </InputContainer>
  );
}
