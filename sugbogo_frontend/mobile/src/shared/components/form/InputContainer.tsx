import { ReactNode } from "react";
import { View } from "react-native";
import AppText from "../AppText";

interface InputContainerProps {
  label: string;
  showLabel?: boolean;
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
  showLabel = true,
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
        {showLabel && (
          <AppText
            weight="bold"
            className="text-xs  tracking-[0.5px] text-text-secondary"
          >
            {label}
            {required && <AppText className="text-text-error"> *</AppText>}
          </AppText>
        )}

        {rightElement}
      </View>

      {/* Input */}
      <View
        className={`flex-row  rounded-input border px-[14px] ${
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
        <AppText className="mt-1 text-xs font-medium text-text-error">
          {error}
        </AppText>
      ) : helperText ? (
        <AppText className="mt-1 text-xs text-text-secondary">
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
}
