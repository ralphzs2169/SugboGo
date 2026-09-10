import { TextInput, TextInputProps, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AppText from "../AppText";
import { theme } from "@/constants/theme";
import InputContainer from "./InputContainer";

interface FormTextAreaProps extends TextInputProps {
  label: string;
  error?: string;
  rightElement?: React.ReactNode;
  required?: boolean;
  helperText?: string;
  minLength?: number;
  showLabel?: boolean;
  showCharacterCount?: boolean;
  InputComponent?: React.ComponentType<TextInputProps>;
}

/**
 * FormTextArea renders a multiline text input within an InputContainer.
 *
 * Supports optional live minimum-length feedback and allows screens with
 * specialized input behavior, such as bottom sheets, to provide their own
 * compatible text input component.
 */
export default function FormTextArea({
  label,
  error,
  rightElement,
  required = false,
  helperText,
  minLength,
  showLabel = true,
  showCharacterCount = false,
  value,
  InputComponent = TextInput,
  ...props
}: FormTextAreaProps) {
  const characterCount = value?.trim().length ?? 0;

  const isValid =
    !error && minLength !== undefined && characterCount >= minLength;

  const showCounter = showCharacterCount && minLength !== undefined;

  const feedback = (
    <View className="mt-1 flex-row items-start gap-2">
      {/* Error or helper message */}
      <View className="min-w-0 flex-1">
        {error ? (
          <AppText className="text-xs font-medium text-text-error">
            {error}
          </AppText>
        ) : helperText ? (
          <AppText className="text-xs text-text-secondary">
            {helperText}
          </AppText>
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

          <AppText
            className={`text-xs ${
              isValid ? "text-success" : "text-text-secondary"
            }`}
          >
            {characterCount}/{minLength}
          </AppText>
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
      bottomElement={feedback}
      showLabel={showLabel}
    >
      <InputComponent
        {...props}
        multiline
        textAlignVertical="top"
        className="min-h-[120px] flex-1 py-[14px] text-body text-text-primary"
        placeholderTextColor={theme.extends.colors.text.tertiary}
        value={value}
      />
    </InputContainer>
  );
}
