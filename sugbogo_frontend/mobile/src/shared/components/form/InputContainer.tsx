import { ReactNode } from "react";
import { Text, View } from "react-native";

interface InputContainerProps {
  label: string;
  error?: string;
  rightElement?: ReactNode;
  children: ReactNode;
  required?: boolean;
  editable?: boolean;
  helperText?: string;
  bottomElement?: ReactNode;
}

/**
 * InputContainer provides a reusable wrapper for form inputs.
 *
 * It renders the field label, input container, validation feedback,
 * helper content, and optional additional content below the input.
 */
export default function InputContainer({
  label,
  error,
  rightElement,
  children,
  required = false,
  editable = true,
  helperText,
  bottomElement,
}: InputContainerProps) {
  return (
    <View className="mb-5">
      {/* Field label */}
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="text-xs font-bold tracking-[0.5px] text-text-secondary">
          {label}
          {required && <Text className="text-text-error"> *</Text>}
        </Text>

        {rightElement}
      </View>

      {/* Input */}
      <View
        className={`flex-row items-center rounded-input border px-[14px] ${
          error
            ? "border-text-error bg-surface"
            : editable
              ? "border-border-primary bg-surface"
              : "border-border-disabled bg-disabled"
        }`}
      >
        {children}
      </View>

      {/* Validation and helper feedback */}
      {bottomElement ? (
        bottomElement
      ) : error ? (
        <Text className="mt-1 text-xs font-medium text-text-error">
          {error}
        </Text>
      ) : helperText ? (
        <Text className="mt-1 text-xs text-text-secondary">{helperText}</Text>
      ) : null}
    </View>
  );
}
